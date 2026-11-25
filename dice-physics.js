/* Small, orthographic cube with planar motion and projected-edge collisions. */
((scope) => {
  const HALF = 9; // Geometry follows the icon stroke center; stroke stays 1.5px.
  const STROKE_RADIUS = .75;
  const CLEARANCE = 0; // Rest directly against the inside edge of the header.
  const STEP = 1 / 120;
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  function rotation(s) {
    const cx = Math.cos(s.ax), sx = Math.sin(s.ax);
    const cy = Math.cos(s.ay), sy = Math.sin(s.ay);
    const cz = Math.cos(s.az), sz = Math.sin(s.az);
    // Row-major Rz * Ry * Rx, also used to project the SVG edges.
    return [cz*cy, cz*sy*sx-sz*cx, cz*sy*cx+sz*sx,
      sz*cy, sz*sy*sx+cz*cx, sz*sy*cx-cz*sx,
      -sy, cy*sx, cy*cx];
  }
  function extent(s) {
    const m = rotation(s);
    return {x: HALF * (Math.abs(m[0])+Math.abs(m[1])+Math.abs(m[2])) + STROKE_RADIUS,
      y: HALF * (Math.abs(m[3])+Math.abs(m[4])+Math.abs(m[5])) + STROKE_RADIUS};
  }
  function create(width, height, x, y, reduced = false) {
    const s = {width, height, x, y, vx: -100, vy: 15,
      ax: 0, ay: 0, az: 0, wx: 6.5, wy: -7.5, wz: -4.2,
      reduced, asleep: false, dragging: false, accumulator: 0};
    if (reduced) { s.wx = .4; s.wy = .5; s.wz = 0; s.vx = -35; }
    confine(s);
    return s;
  }
  function confine(s) {
    const e = extent(s);
    // Keep the projected cube inside the header at every orientation.
    s.x = clamp(s.x, e.x+CLEARANCE, Math.max(e.x+CLEARANCE, s.width-e.x-CLEARANCE));
    s.y = clamp(s.y, e.y+CLEARANCE, Math.max(e.y+CLEARANCE, s.height-e.y-CLEARANCE));
    return e;
  }
  function wake(s) { s.asleep = false; }
  function resize(s, width, height) {
    s.width = width; s.height = height; confine(s); wake(s);
  }
  function launch(s, vx, vy) {
    wake(s); s.dragging = false;
    s.vx = clamp(vx, -1700, 1700); s.vy = clamp(vy, -1700, 1700);
    const spin = s.reduced ? .001 : .009;
    s.wx = clamp(s.vy * spin, -12, 12);
    s.wy = clamp(-s.vx * spin, -12, 12);
    s.wz = clamp(s.vx * spin * .7, -9, 9);
  }
  function impactSpin(s, speed, side) {
    if (s.reduced) return;
    // Orientation-dependent impulses: different corners produce different
    // tumbles, without random kicks during resting contact.
    const kick=Math.min(11,speed*.013);
    s.wx=clamp(s.wx*.55+Math.sin(s.ay*1.7+s.az+.8+side)*kick,-20,20);
    s.wy=clamp(s.wy*.55+Math.sin(s.az*2.1-s.ax+1.9)*kick,-20,20);
    s.wz=clamp(s.wz*.45-s.vx*.025+Math.sin(s.ax+s.ay*1.3+side)*kick*.65,-18,18);
  }
  function tick(s, dt) {
    if (s.dragging || s.asleep) return;
    s.vy += 4500 * dt;
    s.x += s.vx * dt; s.y += s.vy * dt;
    s.ax += s.wx*dt; s.ay += s.wy*dt; s.az += s.wz*dt;
    const e = extent(s), bounce = s.reduced ? .18 : .66;
    if (s.x < e.x+CLEARANCE || s.x > s.width-e.x-CLEARANCE) {
      const left = s.x < e.x+CLEARANCE;
      if ((left && s.vx<0) || (!left && s.vx>0)) {
        const speed=Math.abs(s.vx);
        s.vx *= -.64; impactSpin(s,speed,left?-1:1);
      }
    }
    if (s.y < e.y+CLEARANCE && s.vy<0) {
      const speed=-s.vy; s.vy *= -bounce; impactSpin(s,speed,Math.PI);
    }
    const onFloor = s.y >= s.height-e.y-CLEARANCE;
    if (onFloor) {
      if (s.vy>95) {
        const speed=s.vy;
        // Strong impacts bounce crisply; small hops lose energy rapidly.
        s.vy=-speed*(speed>360?bounce:(s.reduced?.18:.42));
        impactSpin(s,speed,0);
        s.vx*=.52; // Impact friction removes skating without killing the tumble.
      } else if (s.vy>0) s.vy=0;
      s.vx *= Math.exp(-24*dt);
      // Contact torque acts during the last bounces, not in a second animation.
      // Keep angular velocity alive so the die rocks into its supporting face.
      if (Math.abs(s.vy) < 120) {
        const dx = Math.round(s.ax/Math.PI)*Math.PI-s.ax;
        const dz = Math.round(s.az/Math.PI)*Math.PI-s.az;
        s.wx += (440*dx-32*s.wx)*dt;
        s.wz += (440*dz-32*s.wz)*dt;
        s.wy *= Math.exp(-24*dt);
      }

    }
    s.vx *= Math.exp(-.28*dt);
    s.wx *= Math.exp(-.35*dt); s.wy *= Math.exp(-.35*dt); s.wz *= Math.exp(-.35*dt);
    confine(s);
    const tx = Math.round(s.ax/Math.PI)*Math.PI;
    const tz = Math.round(s.az/Math.PI)*Math.PI;
    if (onFloor && Math.abs(s.vy)<.1 && Math.abs(s.vx)<.5 &&
        Math.abs(tx-s.ax)+Math.abs(tz-s.az)<.0005 &&
        Math.abs(s.wx)+Math.abs(s.wy)+Math.abs(s.wz)<.015) {
      // Only remove subpixel residue once contact motion has finished.
      s.ax=tx; s.az=tz; s.vx=s.vy=s.wx=s.wy=s.wz=0; s.asleep=true;
      confine(s); s.y=s.height-extent(s).y;
    }

  }
  function advance(s, elapsed) {
    s.accumulator += clamp(elapsed, 0, .05);
    while (s.accumulator >= STEP) { tick(s, STEP); s.accumulator -= STEP; }
  }
  const api = {HALF, rotation, extent, create, confine, wake, resize, launch, advance};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.HeaderDiePhysics = api;
})(typeof window === 'undefined' ? globalThis : window);
