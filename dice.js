(() => {
  const header = document.querySelector('.header');
  const trigger = document.querySelector('.dice-toggle');
  const actor = document.querySelector('.header-die');
  const cube = actor.querySelector('.die-cube');
  const physics = window.HeaderDiePhysics;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS,'svg');
  svg.setAttribute('viewBox','-22 -22 44 44'); cube.replaceChildren(svg);
  const specs = [
    {n:[0,0,1],u:[1,0,0],v:[0,1,0],p:[0,2,4,6,8]},
    {n:[0,0,-1],u:[-1,0,0],v:[0,1,0],p:[0,8]},
    {n:[1,0,0],u:[0,0,-1],v:[0,1,0],p:[0,4,8]},
    {n:[-1,0,0],u:[0,0,1],v:[0,1,0],p:[0,2,6,8]},
    {n:[0,-1,0],u:[1,0,0],v:[0,0,1],p:[4]},
    {n:[0,1,0],u:[1,0,0],v:[0,0,-1],p:[0,2,3,5,6,8]}
  ];
  function path(fill, stroke=false) {
    const element=document.createElementNS(NS,'path');
    element.setAttribute('fill',fill);
    if (stroke) {
      element.setAttribute('stroke','currentColor');
      element.setAttribute('stroke-width','1.5');
      element.setAttribute('stroke-linejoin','round');
      element.setAttribute('stroke-linecap','round');
      element.setAttribute('vector-effect','non-scaling-stroke');
    }
    return element;
  }
  const defs=document.createElementNS(NS,'defs');
  const clip=document.createElementNS(NS,'clipPath'); clip.id='header-die-silhouette';
  const clipShape=path('white'); clip.append(clipShape); defs.append(clip);
  const fill=path('var(--paper)'), outline=path('none',true);
  const details=document.createElementNS(NS,'g');
  details.setAttribute('clip-path','url(#header-die-silhouette)');
  const seams=path('none',true); details.append(seams);
  const faces=specs.map(spec=>{
    const dots=path('currentColor'); details.append(dots); return {...spec,dots};
  });
  const pipPatterns=[null,[4],[0,8],[0,4,8],[0,2,6,8],[0,2,4,6,8],[0,2,3,5,6,8]];
  function randomizeDock() {
    const number=1+Math.floor(Math.random()*6);
    const remaining=[1,2,3,4,5,6].filter(n=>n!==number && n!==7-number);
    const right=remaining[Math.floor(Math.random()*remaining.length)];
    const top=remaining.find(n=>n!==right && n!==7-right);
    // Preserve opposite faces adding up to seven; front matches the dock icon.
    [number,7-number,right,7-right,top,7-top].forEach((n,i)=>faces[i].p=pipPatterns[n]);
    const dots=trigger.querySelector('svg g');
    dots.replaceChildren(...pipPatterns[number].map(cell=>{
      const dot=document.createElementNS(NS,'circle');
      dot.setAttribute('cx',String(8+(cell%3)*4));
      dot.setAttribute('cy',String(8+Math.floor(cell/3)*4));
      dot.setAttribute('r','1.25'); return dot;
    }));
  }
  randomizeDock();
  svg.append(defs,fill,details,outline);
  const vertices=[];
  for (const x of [-9,9]) for (const y of [-9,9]) for (const z of [-9,9]) vertices.push([x,y,z]);
  const edges=[];
  vertices.forEach((a,i)=>vertices.slice(i+1).forEach((b,offset)=>{
    if (a.filter((value,k)=>value!==b[k]).length===1) edges.push([i,i+offset+1]);
  }));
  function hull(points) {
    const ordered=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
    const chain=items=>{
      const result=[];
      for (const p of items) {
        while (result.length>1 && cross(result.at(-2),result.at(-1),p)<=1e-7) result.pop();
        result.push(p);
      }
      return result.slice(0,-1);
    };
    return [...chain(ordered),...chain([...ordered].reverse())];
  }
  function roundedOutline(points) {
    const corners=points.map((p,i)=>{
      const prev=points[(i+points.length-1)%points.length], next=points[(i+1)%points.length];
      const before=Math.hypot(prev[0]-p[0],prev[1]-p[1]);
      const after=Math.hypot(next[0]-p[0],next[1]-p[1]);
      const radius=Math.min(4,before/3,after/3);
      const toward=(q,d)=>p.map((value,k)=>value+(q[k]-value)*radius/d);
      return {p,entry:toward(prev,before),exit:toward(next,after)};
    });
    return `M${corners[0].entry} `+corners.map(({p,entry,exit},i)=>
      `${i?'L'+entry+' ':''}Q${p} ${exit}`).join(' ')+' Z';
  }
  // Draw a single rounded silhouette, then each shared visible edge once.
  // Stroke after projection so all lines remain 1.5 screen pixels wide.
  function draw(m) {
    const project=a=>[m[0]*a[0]+m[1]*a[1]+m[2]*a[2],m[3]*a[0]+m[4]*a[1]+m[5]*a[2]];
    const projected=vertices.map(project);
    const contour=roundedOutline(hull(projected));
    fill.setAttribute('d',contour); clipShape.setAttribute('d',contour); outline.setAttribute('d',contour);
    seams.setAttribute('d',edges.filter(([i,j])=>{
      const a=vertices[i],b=vertices[j];
      // The two fixed coordinates identify this edge's adjacent face normals.
      return a.filter((value,k)=>value===b[k] && m[6+k]*Math.sign(value)>1e-6).length===2;
    }).map(([i,j])=>`M${projected[i]} L${projected[j]}`).join(' '));
    faces.forEach(face=>{
      const {n,u,v,dots}=face;
      const visible=m[6]*n[0]+m[7]*n[1]+m[8]*n[2]>1e-6;
      dots.style.display=visible?'':'none';
      if (!visible) return;
      const point=(x,y)=>project(n.map((value,i)=>value*9+u[i]*x+v[i]*y)).join(',');
      const r=1.25,c=r*.5522847498;
      dots.setAttribute('d',face.p.map(cell=>{
        const x=(cell%3-1)*4,y=(Math.floor(cell/3)-1)*4;
        return `M${point(x+r,y)} C${point(x+r,y+c)} ${point(x+c,y+r)} ${point(x,y+r)} C${point(x-c,y+r)} ${point(x-r,y+c)} ${point(x-r,y)} C${point(x-r,y-c)} ${point(x-c,y-r)} ${point(x,y-r)} C${point(x+c,y-r)} ${point(x+r,y-c)} ${point(x+r,y)} Z`;
      }).join(' '));
    });
  }
  let state, frame = 0, previous = 0, pointerId = null, samples = [], grab = {x:0,y:0}, dragStart = null, moved = false;
  function render() {
    actor.style.left = state.x + 'px'; actor.style.top = state.y + 'px';
    draw(physics.rotation(state));

  }
  function animate(now) {
    frame=0;
    if (!state || document.hidden) return;
    if (previous) physics.advance(state,(now-previous)/1000);
    previous=now; render();
    if (!state.asleep && !state.dragging) frame=requestAnimationFrame(animate);
  }
  function start() {
    if (!frame && state && !document.hidden) { previous=0; frame=requestAnimationFrame(animate); }
  }
  function reset() {
    if (pointerId !== null && actor.hasPointerCapture(pointerId)) actor.releasePointerCapture(pointerId);
    pointerId=null; state=null; cancelAnimationFrame(frame); frame=0;
    actor.hidden=true; actor.classList.remove('is-dragging');
    trigger.classList.remove('is-active'); trigger.disabled=false; trigger.setAttribute('aria-pressed','false');
    randomizeDock();
    trigger.setAttribute('aria-label','Drop the dice'); trigger.title='Drop the dice';
  }
  trigger.addEventListener('click', () => {
    if (state) { reset(); return; }
    const h=header.getBoundingClientRect(), b=trigger.getBoundingClientRect();
    state=physics.create(header.clientWidth,header.clientHeight,
      b.left+b.width/2-h.left-header.clientLeft,
      b.top+b.height/2-h.top-header.clientTop,reduced.matches);
    actor.hidden=false; trigger.classList.add('is-active'); trigger.disabled=true;
    trigger.setAttribute('aria-pressed','true'); trigger.setAttribute('aria-label','Reset the dice');
    trigger.title='Reset the dice'; render(); start();
    if (matchMedia('(any-hover: hover)').matches) actor.focus({preventScroll:true});
  });
  actor.addEventListener('pointerdown', event => {
    if (!state || pointerId !== null || event.button !== 0) return;
    event.preventDefault(); pointerId=event.pointerId;
    actor.setPointerCapture(pointerId); actor.focus({preventScroll:true});
    physics.wake(state); state.dragging=true; state.vx=state.vy=0;
    cancelAnimationFrame(frame); frame=0;
    const h=header.getBoundingClientRect();
    grab={x:event.clientX-h.left-header.clientLeft-state.x,
      y:event.clientY-h.top-header.clientTop-state.y};
    dragStart={x:event.clientX,y:event.clientY}; moved=false;
    samples=[{x:state.x,y:state.y,t:event.timeStamp}];
    actor.classList.add('is-dragging');
  });
  actor.addEventListener('pointermove', event => {
    if (!state || event.pointerId !== pointerId) return;
    event.preventDefault();
    moved ||= Math.hypot(event.clientX-dragStart.x,event.clientY-dragStart.y)>6;
    const h=header.getBoundingClientRect(), oldX=state.x, oldY=state.y;
    state.x=event.clientX-h.left-header.clientLeft-grab.x;
    state.y=event.clientY-h.top-header.clientTop-grab.y;
    physics.confine(state);
    if (!reduced.matches) {
      state.ay+=(state.x-oldX)*.018; state.ax-=(state.y-oldY)*.018;
    }
    physics.confine(state); render();
    samples.push({x:state.x,y:state.y,t:event.timeStamp});
    samples=samples.filter(sample=>event.timeStamp-sample.t<100);
  });
  function release(event, cancelled=false) {
    if (!state || event.pointerId !== pointerId) return;
    const id=pointerId; pointerId=null;
    if (actor.hasPointerCapture(id)) actor.releasePointerCapture(id);
    actor.classList.remove('is-dragging');
    // The hidden button retains its layout slot. Read its current location so
    // docking still works after resizing, scrolling, or switching mobile views.
    const h=header.getBoundingClientRect(), dock=trigger.getBoundingClientRect();
    const dx=dock.left+dock.width/2-h.left-header.clientLeft;
    const dy=dock.top+dock.height/2-h.top-header.clientTop;
    // A 52px target is forgiving on touch; only intentional drags can dock.
    if (!cancelled && moved && Math.abs(state.x-dx)<=26 && Math.abs(state.y-dy)<=26) {
      reset(); trigger.focus({preventScroll:true}); return;
    }
    const recent=samples.filter(sample=>event.timeStamp-sample.t<100);
    const first=recent[0], last=recent[recent.length-1];
    const dt=first && last ? (last.t-first.t)/1000 : 0;
    const moving=!cancelled && dt>.008 && event.timeStamp-last.t<70;
    physics.launch(state,moving?(last.x-first.x)/dt:0,moving?(last.y-first.y)/dt:0);
    start();
  }
  actor.addEventListener('pointerup', event=>release(event));
  actor.addEventListener('pointercancel', event=>release(event,true));
  actor.addEventListener('lostpointercapture', event=>release(event,true));
  actor.addEventListener('keydown', event => {
    if (event.key==='Escape') { event.preventDefault(); reset(); trigger.focus(); return; }
    const throws={ArrowLeft:[-450,-350],ArrowRight:[450,-350],ArrowUp:[0,-650],ArrowDown:[0,450],' ':[220,-550],Enter:[-220,-550]};
    if (!state || pointerId!==null || !throws[event.key]) return;
    event.preventDefault(); physics.launch(state,...throws[event.key]); start();
  });
  new ResizeObserver(() => {
    if (!state) return;
    physics.resize(state,header.clientWidth,header.clientHeight); render(); start();
  }).observe(header);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame=0; previous=0; }
    else if (state && !state.asleep) start();
  });
  reduced.addEventListener('change', () => { if (state) state.reduced=reduced.matches; });
})();
