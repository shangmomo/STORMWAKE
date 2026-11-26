import * as THREE from '../engine/index.js';

// Lightweight collision world for the character controller and boat.
// Boxes are oriented around Y only. Walkable boxes (decks, floors, stairs) act as ground.
export class Colliders {

	constructor() {

		this.boxes = [];this.triangleWorlds=[];
		this.cylinders = [];
		this._v = new THREE.Vector3();

	}

	// center: world center, half: half extents (x, y, z) in the box's local frame, rotY: yaw (radians)
	addBox( center, half, rotY = 0, { walkable = false, solid = true, tag = '' } = {} ) {

		const b = {
			center: center.clone(), half: half.clone(), rotY,
			cos: Math.cos( rotY ), sin: Math.sin( rotY ),
			walkable, solid, tag,
			top: center.y + half.y, bottom: center.y - half.y,
			radius: Math.hypot( half.x, half.z ),
		};
		this.boxes.push( b );
		return b;

	}

	addCylinder( x, z, radius, yMin, yMax, { tag = '', walkable = false, solid = true } = {} ) {

		const c = { x, z, radius, yMin, yMax, tag, walkable, solid };
		this.cylinders.push( c );
		return c;

	}

	_toLocal( b, x, z ) {

		const dx = x - b.center.x, dz = z - b.center.z;
		return [ dx * b.cos - dz * b.sin, dx * b.sin + dz * b.cos ];

	}

	_toWorldDir( b, lx, lz ) {

		return [ lx * b.cos + lz * b.sin, - lx * b.sin + lz * b.cos ];

	}

	// Highest walkable surface under (x, z) not higher than maxY.
	groundHeightAt( x, z, maxY, pad = 0 ) {

		let best = - Infinity;for(const world of this.triangleWorlds){const h=world.floorAt(x,z,maxY);if(h!==null)best=Math.max(best,h);}
		for ( const b of this.boxes ) {

			if ( ! b.walkable || b.top > maxY ) continue;
			if ( Math.abs( x - b.center.x ) > b.radius + pad + 0.01 || Math.abs( z - b.center.z ) > b.radius + pad + 0.01 ) continue;
			const [ lx, lz ] = this._toLocal( b, x, z );
			if ( Math.abs( lx ) <= b.half.x + pad && Math.abs( lz ) <= b.half.z + pad ) best = Math.max( best, b.top );

		}
		// Circular plinths must contribute walkable height as well as side collision.
		// Previously their visible top could not be stood on, so avatars sank into them.
		for ( const c of this.cylinders ) {
			if ( !c.walkable || c.yMax > maxY ) continue;
			const radius = Math.max( 0, c.radius - pad );
			if ( ( x - c.x ) ** 2 + ( z - c.z ) ** 2 <= radius * radius )
				best = Math.max( best, c.yMax );
		}

		return best;

	}

	// Push a vertical capsule (feet at pos.y) out of solid geometry. Returns true if collided.
	resolveCapsule( pos, radius, height, stepHeight = 0.35, onlyWalkableStep = false ) {

		let hit = false;
		for ( const b of this.boxes ) {

			if ( ! b.solid ) continue;
			if ( pos.y + height < b.bottom || pos.y + (onlyWalkableStep&&!b.walkable?0:stepHeight) > b.top ) continue;
			if ( Math.abs( pos.x - b.center.x ) > b.radius + radius || Math.abs( pos.z - b.center.z ) > b.radius + radius ) continue;
			const [ lx, lz ] = this._toLocal( b, pos.x, pos.z );
			const cx = Math.max( - b.half.x, Math.min( b.half.x, lx ) );
			const cz = Math.max( - b.half.z, Math.min( b.half.z, lz ) );
			let dx = lx - cx, dz = lz - cz;
			const d2 = dx * dx + dz * dz;
			if ( d2 >= radius * radius ) continue;
			let nx, nz, pen;
			if ( d2 > 1e-8 ) {

				const d = Math.sqrt( d2 );
				nx = dx / d; nz = dz / d; pen = radius - d;

			} else {

				// center inside box: push out along the smallest axis
				const px = b.half.x - Math.abs( lx ), pz = b.half.z - Math.abs( lz );
				if ( px < pz ) { nx = Math.sign( lx ) || 1; nz = 0; pen = px + radius; } else { nx = 0; nz = Math.sign( lz ) || 1; pen = pz + radius; }

			}

			const [ wx, wz ] = this._toWorldDir( b, nx, nz );
			pos.x += wx * pen;
			pos.z += wz * pen;
			hit = true;

		}

		for ( const c of this.cylinders ) {

			if ( c.solid === false ) continue;
			if ( pos.y + height < c.yMin || pos.y + (onlyWalkableStep&&!c.walkable?0:stepHeight) > c.yMax ) continue;
			const dx = pos.x - c.x, dz = pos.z - c.z;
			const r = c.radius + radius;
			const d2 = dx * dx + dz * dz;
			if ( d2 >= r * r ) continue;
			const d = Math.sqrt( d2 );
			if ( d < 1e-6 ) { pos.x = c.x + r; pos.z = c.z; }
			else { pos.x = c.x + dx / d * r; pos.z = c.z + dz / d * r; }
			hit = true;

		}

		return hit;

	}

	// Segment/ray against boxes (XZ-plane rotated) for camera occlusion; returns distance or Infinity.
	raycast( origin, dir, maxDist, padding = 0 ) {
		padding = Math.max(0, Number.isFinite(padding)?padding:0);

		let best = maxDist;
		for ( const b of this.boxes ) {

			if ( ! b.solid ) continue;
			const ox = origin.x - b.center.x, oz = origin.z - b.center.z, oy = origin.y - b.center.y;
			const lox = ox * b.cos - oz * b.sin, loz = ox * b.sin + oz * b.cos;
			const ldx = dir.x * b.cos - dir.z * b.sin, ldz = dir.x * b.sin + dir.z * b.cos;
			let tmin = 0, tmax = best;
			const slab = ( o, d, h ) => {

				if ( Math.abs( d ) < 1e-8 ) return Math.abs( o ) <= h;
				let t1 = ( - h - o ) / d, t2 = ( h - o ) / d;
				if ( t1 > t2 ) { const t = t1; t1 = t2; t2 = t; }
				tmin = Math.max( tmin, t1 );
				tmax = Math.min( tmax, t2 );
				return tmin <= tmax;

			};

			if ( slab( lox, ldx, b.half.x+padding ) && slab( oy, dir.y, b.half.y+padding ) && slab( loz, ldz, b.half.z+padding ) ) best = Math.min( best, tmin );

		}

        for(const c of this.cylinders){
            if(c.solid===false)continue;
            const x=origin.x-c.x,z=origin.z-c.z,r=c.radius+padding,a=dir.x**2+dir.z**2,b=x*dir.x+z*dir.z,k=x*x+z*z-r*r;
            let lo=0,hi=best;
            if(a<1e-12){if(k>0)continue;}else{const d=b*b-a*k;if(d<0)continue;lo=Math.max(lo,(-b-Math.sqrt(d))/a);hi=Math.min(hi,(-b+Math.sqrt(d))/a);}
            const min=c.yMin-padding,max=c.yMax+padding;
            if(Math.abs(dir.y)<1e-12){if(origin.y<min||origin.y>max)continue;}else{const t=(min-origin.y)/dir.y,u=(max-origin.y)/dir.y;lo=Math.max(lo,Math.min(t,u));hi=Math.min(hi,Math.max(t,u));}
            if(lo<=hi)best=lo;
        }
		return best;

	}

    // Exact horizontal footprint for legacy solids. Clamp vertical motion at
    // the first crossed underside/top, before horizontal depenetration.
    verticalLimit(from,to,radius,height){
        let y=to.y;const up=y>from.y,down=y<from.y;if(!up&&!down)return y;
        const check=(bottom,top)=>{if(up&&from.y+height<=bottom+1e-5&&y+height>bottom)y=Math.min(y,bottom-height-1e-5);if(down&&from.y>=top-1e-5&&y<top)y=Math.max(y,top+1e-5);};
        for(const b of this.boxes){if(!b.solid)continue;const [x,z]=this._toLocal(b,to.x,to.z);if(Math.hypot(Math.max(0,Math.abs(x)-b.half.x),Math.max(0,Math.abs(z)-b.half.z))>=radius-1e-6)continue;check(b.bottom,b.top);}
        for(const c of this.cylinders){if(c.solid===false||Math.hypot(to.x-c.x,to.z-c.z)>=c.radius+radius-1e-6)continue;check(c.yMin,c.yMax);}
        return y;
    }

}
