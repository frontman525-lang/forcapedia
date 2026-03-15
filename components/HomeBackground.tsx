// Static background for the home page — identical to the login page aesthetic:
// pure black + hand-crafted CSS starfield + Mars planet rising from the bottom.
// No canvas / requestAnimationFrame = zero JS animation overhead.

const CSS = `
/* ── Black base + starfield ── */
.hb-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  background: #000;
  overflow: hidden;
  /* Promote to GPU compositor layer — stays locked during scroll/overscroll bounce */
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  will-change: transform;
}
.hb-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(1px   1px   at  6%  6%,  rgba(255,255,255,0.80) 0%, transparent 100%),
    radial-gradient(1px   1px   at 18% 12%,  rgba(255,255,255,0.50) 0%, transparent 100%),
    radial-gradient(1.5px 1.5px at 31%  4%,  rgba(255,255,255,0.70) 0%, transparent 100%),
    radial-gradient(1px   1px   at 44% 19%,  rgba(255,255,255,0.40) 0%, transparent 100%),
    radial-gradient(1px   1px   at 57%  8%,  rgba(255,255,255,0.60) 0%, transparent 100%),
    radial-gradient(1.5px 1.5px at 70%  3%,  rgba(255,255,255,0.90) 0%, transparent 100%),
    radial-gradient(1px   1px   at 82% 15%,  rgba(255,255,255,0.50) 0%, transparent 100%),
    radial-gradient(1px   1px   at 93% 22%,  rgba(255,255,255,0.60) 0%, transparent 100%),
    radial-gradient(1px   1px   at  3% 28%,  rgba(255,255,255,0.40) 0%, transparent 100%),
    radial-gradient(1px   1px   at 12% 38%,  rgba(255,255,255,0.30) 0%, transparent 100%),
    radial-gradient(1.5px 1.5px at 25% 32%,  rgba(255,255,255,0.60) 0%, transparent 100%),
    radial-gradient(1px   1px   at 38% 44%,  rgba(255,255,255,0.40) 0%, transparent 100%),
    radial-gradient(1px   1px   at 52% 36%,  rgba(255,255,255,0.50) 0%, transparent 100%),
    radial-gradient(1px   1px   at 65% 28%,  rgba(255,255,255,0.30) 0%, transparent 100%),
    radial-gradient(1.5px 1.5px at 77% 40%,  rgba(255,255,255,0.70) 0%, transparent 100%),
    radial-gradient(1px   1px   at 88% 33%,  rgba(255,255,255,0.40) 0%, transparent 100%),
    radial-gradient(1px   1px   at  8% 52%,  rgba(255,255,255,0.30) 0%, transparent 100%),
    radial-gradient(1px   1px   at 48% 56%,  rgba(255,255,255,0.50) 0%, transparent 100%),
    radial-gradient(1px   1px   at 91% 48%,  rgba(255,255,255,0.40) 0%, transparent 100%),
    radial-gradient(1.5px 1.5px at 35% 60%,  rgba(255,255,255,0.60) 0%, transparent 100%);
}

/* Light mode: keep this layer neutral and clean. */
html.light .hb-bg {
  background: #F7F5F0;
}
html.light .hb-bg::before {
  display: none;
}

/* ── Mars planet ── */
.hb-mars-container {
  position: fixed;
  bottom: -87vw;
  left: 50%;
  transform: translateX(-50%) translateZ(0);
  -webkit-transform: translateX(-50%) translateZ(0);
  will-change: transform;
  width: 110vw;
  height: 110vw;
  max-width: 1500px;
  max-height: 1500px;
  z-index: 2;
  pointer-events: none;
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(0,0,0,0.5) 10%,
    black 24%,
    black 100%
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(0,0,0,0.5) 10%,
    black 24%,
    black 100%
  );
  animation: hb-marsRise 2.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: 0.1s;
}

@keyframes hb-marsRise {
  from { transform: translateX(-50%) translateY(6%); opacity: 0.3; }
  to   { transform: translateX(-50%) translateY(0);  opacity: 1; }
}

.hb-mars {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  position: relative;
  background:
    /* Polar cap — faint bright patch at top-center */
    radial-gradient(ellipse 18% 6%  at 50%  2%,  rgba(240,210,180,0.28) 0%, transparent 100%),
    /* Bright limb highlight — sunlit crescent edge */
    radial-gradient(ellipse 75% 22% at 50%  4%,  rgba(210,120,55,0.50)  0%, transparent 100%),
    /* Dark volcanic highlands — left */
    radial-gradient(ellipse 32% 20% at 13% 11%,  rgba(100,30,10,0.65)   0%, transparent 100%),
    /* Mid-tone terrae — right */
    radial-gradient(ellipse 28% 16% at 85%  9%,  rgba(170,65,22,0.42)   0%, transparent 100%),
    /* Narrow dark band — Valles Marineris hint */
    radial-gradient(ellipse 80%  4% at 50% 21%,  rgba(40,8,2,0.60)      0%, transparent 100%),
    /* Broad mid-tone lowlands */
    radial-gradient(ellipse 95% 42% at 50% 34%,  rgba(145,48,15,0.50)   0%, transparent 100%),
    /* Southern highlands — darker, more muted */
    radial-gradient(ellipse 90% 28% at 50% 62%,  rgba(80,22,7,0.55)     0%, transparent 100%),
    /* Base sphere gradient — warm rust core to near-black limb */
    radial-gradient(ellipse 130% 65% at 50%  6%,
      #C05018 0%,
      #A03410  14%,
      #87240C  30%,
      #671608  50%,
      #380A03  72%,
      #100200 100%
    );
  box-shadow:
    /* Soft inner shadow — gives volume, removes "glassy ball" look */
    inset 0   0   80px  20px rgba(0,0,0,0.30),
    inset -30px -15px 90px   0 rgba(0,0,0,0.35),
    inset  18px  10px 55px   0 rgba(180,90,30,0.10),
    /* Outer atmospheric glow */
    0 0  60px  28px rgba(175, 60, 12, 0.60),
    0 0 140px  70px rgba(148, 44,  8, 0.34),
    0 0 340px 140px rgba(120, 30,  4, 0.16),
    0 0 650px 280px rgba( 90, 20,  0, 0.08);
}

.hb-mars::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background:
    /* Surface craters — subtle dark ellipses */
    radial-gradient(ellipse 3.5% 2.5% at 17% 30%,  rgba(0,0,0,0.32) 0%, transparent 100%),
    radial-gradient(ellipse 2.2% 1.8% at 52% 24%,  rgba(0,0,0,0.24) 0%, transparent 100%),
    radial-gradient(ellipse 4.5% 3.2% at 68% 38%,  rgba(0,0,0,0.22) 0%, transparent 100%),
    radial-gradient(ellipse 2%   1.5% at 36% 60%,  rgba(0,0,0,0.20) 0%, transparent 100%),
    radial-gradient(ellipse 5.5% 4%   at 12% 56%,  rgba(0,0,0,0.18) 0%, transparent 100%),
    radial-gradient(ellipse 8%   5.5% at 43% 40%,  rgba(0,0,0,0.14) 0%, transparent 100%),
    radial-gradient(ellipse 2.5% 2%   at 74% 18%,  rgba(0,0,0,0.20) 0%, transparent 100%),
    radial-gradient(ellipse 3%   2%   at 28% 45%,  rgba(0,0,0,0.16) 0%, transparent 100%),
    /* Terminator — strong limb darkening on shadow side */
    linear-gradient(112deg,
      rgba(255,130,50,0.04) 0%,
      transparent           28%,
      transparent           52%,
      rgba(0,0,0,0.28)      70%,
      rgba(0,0,0,0.58)      86%,
      rgba(0,0,0,0.82)     100%
    );
}

.hb-mars::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 50%;
  box-shadow:
    /* Very thin atmospheric rim — warm peach, not glassy-white */
    inset 0 0 0 2px rgba(220,150,60,0.12),
    0 0 28px 6px rgba(200,90,25,0.22);
}
`

export default function HomeBackground({ noMars = false }: { noMars?: boolean }) {
  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="hb-bg" />
      {!noMars && (
        <div className="hb-mars-container">
          <div className="hb-mars" />
        </div>
      )}
    </>
  )
}
