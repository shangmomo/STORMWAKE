export class Broker {constructor({voyage,cargo,shipId='stormwake'}={}){this.voyage=voyage;this.cargo=cargo;this.shipId=shipId;}
 sell(){const chest=this.cargo.listShipHold(this.shipId).find(item=>!item.origin);if(!chest||!this.voyage.sell(chest.id))return false;this.cargo.remove(chest.id);return true;}
}
