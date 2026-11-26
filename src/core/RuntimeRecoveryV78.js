// Fail closed: never continue rendering a half-updated world after a frame
// exception or lost GPU. A reload is explicit, not an automatic crash loop.
export function showRuntimeFailure(app,error){
 if(app._runtimeFailed)return;app._runtimeFailed=true;app.engine?.stop();if(app.input){app.input.enabled=false;app.input.resetPhysicalState?.();}
 try{document.exitPointerLock?.();}catch{}
 console.error('[V78] runtime stopped',error);
 const panel=document.createElement('div');panel.setAttribute('role','alert');panel.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#15252b;color:#eee5d5;display:grid;place-items:center;font:16px system-ui;padding:24px;';
 const box=document.createElement('section');box.style.cssText='max-width:560px;background:#21383d;padding:28px;border:1px solid #927e59;border-radius:12px;';const title=document.createElement('h2');title.textContent='游戏已安全停止';const body=document.createElement('p');body.textContent='运行发生异常。已停止模拟及输入，避免继续写入错误状态。可以重新加载游戏；未保存的本次操作可能丢失。';const detail=document.createElement('pre');detail.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;max-height:180px;overflow:auto';detail.textContent=String(error?.message||error).slice(0,1500);const btn=document.createElement('button');btn.textContent='重新加载';btn.style.cssText='padding:12px 20px;cursor:pointer';btn.onclick=()=>location.reload();box.append(title,body,detail,btn);panel.append(box);document.body.append(panel);
}
