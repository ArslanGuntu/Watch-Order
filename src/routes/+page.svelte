<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes"/>
<title>WatchOrder — Never Watch a Franchise in the Wrong Order Again</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600;1,700&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Sora:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: #030303;
  color: #f0ece4;
  font-family: 'Sora', sans-serif;
  overflow-x: hidden;
  cursor: default;
}

/* Custom Cursor */
.custom-dot {
  position: fixed;
  z-index: 10000;
  pointer-events: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c9a84c;
  transform: translate(-50%, -50%);
  transition: left 0.04s linear, top 0.04s linear;
  box-shadow: 0 0 8px #c9a84c;
}

.custom-ring {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  width: 28px;
  height: 28px;
  border: 1px solid rgba(201, 168, 76, 0.45);
  border-radius: 50%;
  transition: left 0.1s ease, top 0.1s ease;
}

/* Grain Effect */
.grain {
  position: fixed;
  inset: 0;
  z-index: 9998;
  pointer-events: none;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* Navigation */
.nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 500;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 48px;
  height: 64px;
  transition: all 0.6s ease;
  opacity: 0;
  transform: translateY(-100%);
  background: transparent;
}

.nav.nav-visible {
  opacity: 1;
  transform: translateY(0);
}

.nav.nav-scrolled {
  background: rgba(3, 3, 3, 0.92);
  backdrop-filter: blur(24px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.055);
}

.nav-logo {
  display: flex;
  align-items: baseline;
  gap: 0;
  justify-self: start;
  text-decoration: none;
}

.nav-logo-mark {
  font-family: 'Cormorant Garamond', serif;
  font-size: 2rem;
  font-weight: 700;
  color: #c9a84c;
  line-height: 1;
}

.nav-logo-text {
  font-family: 'Cormorant Garamond', serif;
  font-size: 1.5rem;
  font-weight: 300;
  color: #f0ece4;
}

.nav-logo-accent {
  font-family: 'Cormorant Garamond', serif;
  font-size: 1.5rem;
  font-weight: 600;
  font-style: italic;
  color: #f0ece4;
}

.nav-logo-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c9a84c;
  box-shadow: 0 0 8px #c9a84c;
  margin-left: 4px;
  margin-bottom: 2px;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 36px;
  list-style: none;
  justify-self: center;
}

.nav-links a {
  font-family: 'Space Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(240, 236, 228, 0.28);
  text-decoration: none;
  transition: color 0.2s;
}

.nav-links a:hover {
  color: #c9a84c;
}

.nav-cta {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-self: end;
  font-family: 'Space Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #030303;
  background: #c9a84c;
  padding: 9px 20px;
  border-radius: 1px;
  text-decoration: none;
  transition: background 0.2s;
}

.nav-cta:hover {
  background: #e8c46a;
}

/* Hero Section */
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: flex-end;
  padding: 0 60px 80px;
  overflow: hidden;
  background: #030303;
}

.hero-bg-image {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 70%;
  background-image: url('https://image.tmdb.org/t/p/w1280/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg');
  background-size: cover;
  background-position: center right;
  mask-image: linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 30%, rgba(0,0,0,0) 100%);
  -webkit-mask-image: linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 30%, rgba(0,0,0,0) 100%);
  opacity: 0.4;
  z-index: 0;
}

.hero-bg-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 30% 50%, transparent 0%, #030303 90%);
  z-index: 1;
}

.hero-content {
  position: relative;
  z-index: 3;
  max-width: 820px;
}

.hero-title {
  margin-bottom: 36px;
}

.hero-title span {
  display: block;
  opacity: 0;
  transform: translateY(50px) skewY(1.5deg);
  transition: opacity 0.8s ease, transform 0.8s ease;
}

.hero-title span.hero-visible {
  opacity: 1;
  transform: translateY(0) skewY(0);
}

.hero-line-1,
.hero-line-3,
.hero-line-4 {
  font-family: 'Cormorant Garamond', serif;
  font-weight: 700;
  font-size: clamp(4.5rem, 11vw, 11.5rem);
  letter-spacing: -0.02em;
  color: #f0ece4;
  line-height: 0.9;
}

.hero-line-2,
.hero-line-5 {
  font-family: 'Cormorant Garamond', serif;
  font-weight: 300;
  font-size: clamp(2.8rem, 6vw, 6.5rem);
  letter-spacing: -0.02em;
  padding-left: clamp(1.5rem, 5vw, 6rem);
  line-height: 0.9;
}

.hero-line-2 {
  color: rgba(240, 236, 228, 0.55);
}

.hero-line-4 {
  color: transparent;
  -webkit-text-stroke: 2px rgba(240, 236, 228, 0.18);
}

.hero-line-5 {
  color: #c9a84c;
}

.hero-subtitle {
  font-size: 0.98rem;
  line-height: 1.8;
  font-weight: 300;
  color: rgba(240, 236, 228, 0.55);
  max-width: 500px;
  margin-bottom: 40px;
  opacity: 0;
  transform: translateY(18px);
  transition: opacity 0.7s ease, transform 0.7s ease;
}

.hero-subtitle.hero-visible {
  opacity: 1;
  transform: translateY(0);
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 40px;
  opacity: 0;
  transform: translateY(18px);
  transition: opacity 0.7s ease, transform 0.7s ease;
  flex-wrap: wrap;
}

.hero-actions.hero-visible {
  opacity: 1;
  transform: translateY(0);
}

.btn-primary {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  gap: 0;
  background: #c9a84c;
  clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));
  transition: background 0.25s, transform 0.25s;
  text-decoration: none;
  font-family: 'Sora', sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #030303;
  padding: 15px 28px;
}

.btn-primary:hover {
  background: #e8c46a;
  transform: translateY(-2px);
}

.btn-primary span {
  position: relative;
  z-index: 1;
}

.btn-primary svg {
  margin-left: 12px;
  position: relative;
  z-index: 1;
}

.btn-ghost {
  font-family: 'Space Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(240, 236, 228, 0.28);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 2px;
  text-decoration: none;
  transition: color 0.2s, border-color 0.2s;
}

.btn-ghost:hover {
  color: #f0ece4;
  border-color: rgba(240, 236, 228, 0.28);
}

.hero-stats {
  display: flex;
  align-items: center;
  gap: 0;
  opacity: 0;
  transform: translateY(18px);
  transition: opacity 0.7s ease, transform 0.7s ease;
}

.hero-stats.hero-visible {
  opacity: 1;
  transform: translateY(0);
}

.hero-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 28px;
  border-right: 1px solid rgba(255, 255, 255, 0.055);
}

.hero-stat:first-child {
  border-left: 1px solid rgba(255, 255, 255, 0.055);
}

.stat-value {
  font-family: 'Cormorant Garamond', serif;
  font-size: 2rem;
  font-weight: 700;
  color: #f0ece4;
  line-height: 1;
  letter-spacing: -0.02em;
}

.stat-label {
  font-family: 'Space Mono', monospace;
  font-size: 0.52rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(240, 236, 228, 0.28);
  margin-top: 4px;
}

.hero-vertical-label {
  position: absolute;
  right: 52px;
  top: 50%;
  transform: translateY(-50%) rotate(90deg) translateX(-50%);
  transform-origin: center;
  font-family: 'Space Mono', monospace;
  font-size: 0.5rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: rgba(240, 236, 228, 0.1);
  white-space: nowrap;
  z-index: 3;
  opacity: 0;
  transition: opacity 0.8s ease;
}

.hero-vertical-label.hero-visible {
  opacity: 1;
}

.scroll-indicator {
  position: absolute;
  bottom: 32px;
  right: 52px;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.8s ease;
}

.scroll-indicator.hero-visible {
  opacity: 1;
}

.scroll-line {
  width: 1px;
  height: 48px;
  background: linear-gradient(to bottom, transparent, #c9a84c);
  animation: scrollDrop 2s ease-in-out infinite;
}

@keyframes scrollDrop {
  0%, 100% { transform: scaleY(0); transform-origin: top; }
  50% { transform: scaleY(1); transform-origin: top; }
}

.scroll-indicator span {
  font-family: 'Space Mono', monospace;
  font-size: 0.48rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(240, 236, 228, 0.1);
  writing-mode: vertical-lr;
}

/* Ticker */
.ticker {
  overflow: hidden;
  background: #c9a84c;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 11px 0;
}

.ticker-track {
  display: flex;
  width: max-content;
  animation: tickerMove 40s linear infinite;
}

@keyframes tickerMove {
  from { transform: translateX(0); }
  to { transform: translateX(-33.333%); }
}

.ticker-item {
  font-family: 'Space Mono', monospace;
  font-size: 0.72rem;
  letter-spacing: 0.2em;
  color: rgba(3, 3, 3, 0.85);
  padding: 0 28px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 28px;
}

.ticker-sep {
  font-size: 0.45rem;
  opacity: 0.6;
}

/* Responsive */
@media (max-width: 1200px) {
  .hero-bg-image {
    width: 100%;
    mask-image: linear-gradient(to left, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 70%);
    -webkit-mask-image: linear-gradient(to left, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 70%);
  }
}

@media (max-width: 768px) {
  .nav {
    padding: 0 24px;
    grid-template-columns: 1fr auto;
  }
  .nav-links {
    display: none;
  }
  .hero {
    padding: 0 24px 60px;
  }
  .hero-stats {
    flex-wrap: wrap;
  }
  .hero-bg-image {
    width: 100%;
    opacity: 0.25;
    mask-image: linear-gradient(to left, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 50%);
    -webkit-mask-image: linear-gradient(to left, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 50%);
  }
  .hero-vertical-label {
    display: none;
  }
}

/* Franchises Section */
.franchises-section {
  padding: 100px 60px;
  background: #080808;
  border-top: 1px solid rgba(255, 255, 255, 0.055);
}

.section-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 60px;
  gap: 24px;
  max-width: 1280px;
  margin-left: auto;
  margin-right: auto;
}

.section-overtitle {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'Space Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #c9a84c;
  margin-bottom: 20px;
}

.overtitle-bar {
  width: 22px;
  height: 1px;
  background: #c9a84c;
}

.section-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(2.4rem, 4vw, 3.8rem);
  font-weight: 300;
  line-height: 1.08;
  letter-spacing: -0.03em;
  color: #f0ece4;
}

.section-title em {
  font-style: italic;
  color: #c9a84c;
  font-weight: 300;
}

.view-all-link {
  font-family: 'Space Mono', monospace;
  font-size: 0.58rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(240, 236, 228, 0.28);
  border-bottom: 1px solid rgba(255, 255, 255, 0.055);
  padding-bottom: 2px;
  text-decoration: none;
  transition: color 0.2s, border-color 0.2s;
  white-space: nowrap;
}

.view-all-link:hover {
  color: #c9a84c;
  border-color: rgba(201, 168, 76, 0.4);
}

.franchise-list {
  max-width: 1280px;
  margin: 0 auto;
}

.franchise-row {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: 120px 1fr auto 180px 60px;
  align-items: center;
  gap: 20px;
  padding: 24px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.055);
  text-decoration: none;
  transition: padding-left 0.35s ease;
  cursor: none;
}

.franchise-row:first-child {
  border-top: 1px solid rgba(255, 255, 255, 0.055);
}

.franchise-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  transition: opacity 0.4s ease;
  filter: saturate(0.2) brightness(0.18);
}

.franchise-bg-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, #080808 0%, transparent 50%);
  transition: opacity 0.4s ease;
}

.franchise-active-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  transform: scaleY(0);
  transform-origin: bottom;
  transition: transform 0.3s ease;
}

.franchise-left {
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  z-index: 1;
}

.franchise-idx {
  font-family: 'Space Mono', monospace;
  font-size: 0.58rem;
  color: rgba(240, 236, 228, 0.1);
  letter-spacing: 0.1em;
  width: 24px;
}

.franchise-type {
  font-family: 'Space Mono', monospace;
  font-size: 0.5rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(240, 236, 228, 0.28);
}

.franchise-years {
  font-family: 'Space Mono', monospace;
  font-size: 0.5rem;
  color: rgba(240, 236, 228, 0.1);
}

.franchise-center {
  position: relative;
  z-index: 1;
}

.franchise-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(1.4rem, 2.5vw, 2rem);
  font-weight: 400;
  letter-spacing: -0.01em;
  transition: color 0.3s;
  line-height: 1;
  display: block;
}

.franchise-desc {
  font-family: 'Sora', sans-serif;
  font-size: 0.78rem;
  font-weight: 300;
  color: rgba(240, 236, 228, 0.55);
  line-height: 1.5;
  transition: opacity 0.3s;
  max-width: 500px;
  margin-top: 4px;
}

.franchise-right {
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  z-index: 1;
  justify-content: flex-end;
}

.franchise-entries {
  font-family: 'Space Mono', monospace;
  font-size: 0.56rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  transition: color 0.3s;
}

.franchise-arrow {
  color: #c9a84c;
  transition: opacity 0.3s, transform 0.3s;
}

.franchise-thumb {
  position: absolute;
  right: 64px;
  top: 50%;
  transform: translateY(-50%);
  width: 52px;
  height: 78px;
  border-radius: 3px;
  overflow: hidden;
  transition: opacity 0.3s, transform 0.3s;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
  z-index: 2;
}

.franchise-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.7);
}

/* Labels */
.label {
  font-family: 'Space Mono', monospace;
  font-size: 0.5rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  border: 1px solid;
  border-radius: 1px;
  padding: 3px 8px;
  white-space: nowrap;
}

.lbl-amber { color: #c9a84c; border-color: rgba(201, 168, 76, 0.35); background: rgba(201, 168, 76, 0.08); }
.lbl-blue { color: #5dade2; border-color: rgba(93, 173, 226, 0.35); background: rgba(93, 173, 226, 0.08); }
.lbl-green { color: #5fbf8c; border-color: rgba(95, 191, 140, 0.35); background: rgba(95, 191, 140, 0.08); }
.lbl-red { color: #e74c3c; border-color: rgba(231, 76, 60, 0.35); background: rgba(231, 76, 60, 0.08); }

/* Split Section */
.split-section {
  padding: 100px 60px;
  background: #030303;
  border-top: 1px solid rgba(255, 255, 255, 0.055);
}

.split-container {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0;
  max-width: 1200px;
  margin: 0 auto;
  align-items: start;
}

.split-side {
  padding: 0 60px;
}

.split-badge {
  font-family: 'Space Mono', monospace;
  font-size: 0.56rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  padding: 6px 14px;
  border-radius: 1px;
  display: inline-block;
  margin-bottom: 28px;
}

.split-badge.bad { color: #e74c3c; border: 1px solid rgba(231, 76, 60, 0.3); background: rgba(231, 76, 60, 0.08); }
.split-badge.good { color: #5fbf8c; border: 1px solid rgba(95, 191, 140, 0.3); background: rgba(95, 191, 140, 0.08); }

.split-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(1.8rem, 3vw, 2.8rem);
  font-weight: 300;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: #f0ece4;
  margin-bottom: 36px;
}

.split-title em {
  font-style: italic;
  color: #c9a84c;
}

.split-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.split-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  font-family: 'Sora', sans-serif;
  font-size: 0.85rem;
  font-weight: 300;
  line-height: 1.5;
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.055);
  border-radius: 1px;
  transition: border-color 0.2s, background 0.2s;
}

.split-item.bad { color: rgba(240, 236, 228, 0.55); }
.split-item.bad:hover { border-color: rgba(231, 76, 60, 0.2); background: rgba(231, 76, 60, 0.04); }
.split-item.good { color: rgba(240, 236, 228, 0.55); }
.split-item.good:hover { border-color: rgba(95, 191, 140, 0.2); background: rgba(95, 191, 140, 0.04); }

.split-icon {
  font-size: 0.9rem;
  flex-shrink: 0;
  margin-top: 1px;
}

.split-item.bad .split-icon { color: #e74c3c; }
.split-item.good .split-icon { color: #5fbf8c; }

.split-divider {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  padding: 60px 0;
}

.divider-line {
  flex: 1;
  width: 1px;
  background: rgba(255, 255, 255, 0.055);
}

.divider-circle {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Space Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  color: rgba(240, 236, 228, 0.28);
  background: #0e0e0e;
  margin: 20px 0;
}

/* Features Section */
.features-section {
  padding: 100px 60px;
  background: #080808;
  border-top: 1px solid rgba(255, 255, 255, 0.055);
}

.features-container {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 80px;
  align-items: start;
  max-width: 1200px;
  margin: 0 auto;
}

.feature-tab {
  display: grid;
  grid-template-columns: 52px 1fr 4px;
  align-items: start;
  gap: 16px;
  padding: 22px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.055);
  cursor: none;
  text-align: left;
  transition: background 0.2s;
  width: 100%;
  background: transparent;
}

.feature-tab:hover {
  background: #0e0e0e;
  padding-left: 8px;
  padding-right: 8px;
}

.feature-tab.active {
  background: #0e0e0e;
  padding-left: 8px;
  padding-right: 8px;
}

.tab-number {
  font-family: 'Space Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  color: rgba(240, 236, 228, 0.1);
  padding-top: 4px;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tab-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: 1.2rem;
  font-weight: 600;
  color: #f0ece4;
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.feature-tab:not(.active) .tab-title {
  color: rgba(240, 236, 228, 0.55);
}

.tab-sub {
  font-family: 'Sora', sans-serif;
  font-size: 0.74rem;
  font-weight: 300;
  color: rgba(240, 236, 228, 0.28);
  line-height: 1.5;
}

.tab-bar {
  width: 3px;
  align-self: stretch;
  background: #c9a84c;
  border-radius: 2px;
  opacity: 0;
  transition: opacity 0.3s;
}

.feature-tab.active .tab-bar {
  opacity: 1;
}

.features-display {
  position: relative;
  min-height: 500px;
}

.feature-panel {
  position: absolute;
  inset: 0;
  opacity: 0;
  transform: translateX(24px);
  transition: opacity 0.5s ease, transform 0.5s ease;
  pointer-events: none;
}

.feature-panel.active {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}

.feature-image {
  position: relative;
  border-radius: 3px;
  overflow: hidden;
  height: 320px;
  margin-bottom: 28px;
}

.feature-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.5) brightness(0.45);
}

.feature-image-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, #080808 0%, transparent 50%);
}

.feature-image-number {
  position: absolute;
  right: 20px;
  bottom: 16px;
  font-family: 'Cormorant Garamond', serif;
  font-size: 5rem;
  font-weight: 700;
  line-height: 1;
  color: transparent;
  -webkit-text-stroke: 1px rgba(201, 168, 76, 0.2);
  letter-spacing: -0.02em;
}

.feature-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: 2rem;
  font-weight: 600;
  color: #f0ece4;
  margin-bottom: 12px;
  letter-spacing: -0.02em;
}

.feature-detail {
  font-family: 'Sora', sans-serif;
  font-size: 0.88rem;
  font-weight: 300;
  line-height: 1.8;
  color: rgba(240, 236, 228, 0.55);
}

/* Guide Section */
.guide-section {
  padding: 100px 60px;
  background: #080808;
  border-top: 1px solid rgba(255, 255, 255, 0.055);
}

.guide-container {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 80px;
  align-items: start;
  max-width: 1200px;
  margin: 0 auto;
}

.guide-left {
  position: sticky;
  top: 100px;
}

.guide-desc {
  font-family: 'Sora', sans-serif;
  font-size: 0.92rem;
  line-height: 1.8;
  font-weight: 300;
  color: rgba(240, 236, 228, 0.55);
  margin-top: 20px;
}

.guide-toggles {
  display: flex;
  gap: 8px;
  margin-top: 32px;
}

.toggle-btn {
  font-family: 'Space Mono', monospace;
  font-size: 0.56rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 9px 18px;
  border: 1px solid rgba(255, 255, 255, 0.055);
  border-radius: 1px;
  color: rgba(240, 236, 228, 0.28);
  background: transparent;
  transition: all 0.2s;
  cursor: none;
}

.toggle-btn.active {
  background: rgba(201, 168, 76, 0.14);
  color: #c9a84c;
  border-color: rgba(201, 168, 76, 0.35);
}

.guide-panel {
  background: #0e0e0e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.guide-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 28px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.055);
  background: #141414;
}

.guide-header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.guide-thumb {
  width: 40px;
  height: 60px;
  object-fit: cover;
  border-radius: 2px;
  filter: saturate(0.7);
}

.guide-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: 1.15rem;
  font-weight: 600;
  color: #f0ece4;
  letter-spacing: -0.01em;
}

.guide-meta {
  font-family: 'Space Mono', monospace;
  font-size: 0.52rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(240, 236, 228, 0.28);
  margin-top: 4px;
}

.guide-progress {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 28px;
  background: #1a1a1a;
  border-bottom: 1px solid rgba(255, 255, 255, 0.055);
}

.progress-fill {
  height: 2px;
  background: #c9a84c;
  border-radius: 1px;
}

.progress-label {
  font-family: 'Space Mono', monospace;
  font-size: 0.5rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(240, 236, 228, 0.1);
}

.guide-entries {
  padding: 0;
}

.guide-entry {
  display: grid;
  grid-template-columns: 60px 1fr auto;
  align-items: start;
  gap: 16px;
  padding: 18px 28px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.055);
  transition: background 0.15s;
}

.guide-entry:hover {
  background: #141414;
}

.entry-left {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.entry-number {
  font-family: 'Space Mono', monospace;
  font-size: 0.54rem;
  color: rgba(240, 236, 228, 0.1);
  padding-top: 3px;
}

.entry-dot-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

.entry-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid;
}

.entry-dot.lbl-amber { background: rgba(201, 168, 76, 0.3); border-color: #c9a84c; }

.entry-connector {
  width: 1px;
  height: 32px;
  background: rgba(255, 255, 255, 0.055);
  margin-top: 4px;
}

.entry-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 5px;
  flex-wrap: wrap;
}

.entry-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: 1.1rem;
  font-weight: 600;
  color: #f0ece4;
  letter-spacing: -0.01em;
}

.entry-year, .entry-time {
  font-family: 'Space Mono', monospace;
  font-size: 0.52rem;
  color: rgba(240, 236, 228, 0.1);
}

.entry-note {
  font-family: 'Sora', sans-serif;
  font-size: 0.78rem;
  font-weight: 300;
  color: rgba(240, 236, 228, 0.55);
  line-height: 1.55;
}

.guide-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px;
  border-top: 1px solid rgba(255, 255, 255, 0.055);
}

.guide-footer span {
  font-family: 'Space Mono', monospace;
  font-size: 0.52rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(240, 236, 228, 0.1);
}

.guide-footer a {
  font-family: 'Space Mono', monospace;
  font-size: 0.52rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #c9a84c;
  text-decoration: none;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.guide-footer a:hover {
  opacity: 1;
}

/* Responsive */
@media (max-width: 1200px) {
  .features-container, .guide-container {
    grid-template-columns: 1fr;
  }
  .guide-left {
    position: static;
  }
  .split-container {
    grid-template-columns: 1fr;
  }
  .split-divider {
    flex-direction: row;
    padding: 24px 0;
  }
  .divider-line {
    height: 1px;
    flex: 1;
  }
  .divider-circle {
    margin: 0 16px;
  }
}

@media (max-width: 768px) {
  .franchises-section, .split-section, .features-section, .guide-section {
    padding-left: 24px;
    padding-right: 24px;
  }
  .franchise-row {
    grid-template-columns: 40px 1fr auto;
  }
  .franchise-type, .franchise-years, .franchise-entries {
    display: none;
  }
  .franchise-thumb {
    display: none;
  }
  .guide-entry {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .entry-left {
    display: none;
  }
}
</style>
</head>
<body>

<!-- Custom Cursor -->
<div class="custom-dot" id="customDot"></div>
<div class="custom-ring" id="customRing"></div>

<!-- Grain Effect -->
<div class="grain"></div>

<!-- Navigation -->
<nav class="nav" id="mainNav">
  <a href="/" class="nav-logo">
    <span class="nav-logo-mark">W</span>
    <span class="nav-logo-text">atch</span>
    <span class="nav-logo-accent">Order</span>
    <span class="nav-logo-dot"></span>
  </a>

  <ul class="nav-links">
    <li><a href="/franchises">Franchises</a></li>
    <li><a href="/anime">Anime</a></li>
    <li><a href="/series">Series</a></li>
    <li><a href="/new">New Guides</a></li>
  </ul>

  <a href="/franchises" class="nav-cta">
    <span>Browse Guides</span>
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" stroke-width="1.4"/></svg>
  </a>
</nav>

<!-- Hero Section -->
<section class="hero">
  <div class="hero-bg-image"></div>
  <div class="hero-bg-overlay"></div>

  <div class="hero-content">
    <h1 class="hero-title">
      <span class="hero-line-1" id="line1">NEVER</span>
      <span class="hero-line-2" id="line2">watch a franchise</span>
      <span class="hero-line-3" id="line3">IN THE</span>
      <span class="hero-line-4" id="line4">WRONG</span>
      <span class="hero-line-5" id="line5">order again.</span>
    </h1>

    <p class="hero-subtitle" id="heroSubtitle">
      Every major franchise. Release order and story timeline. Every entry labeled — essential, optional, or skip. One place. Zero confusion.
    </p>

    <div class="hero-actions" id="heroActions">
      <a href="/franchises" class="btn-primary">
        <span>Browse All Franchises</span>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" stroke-width="1.4"/></svg>
      </a>
      <a href="#how" class="btn-ghost">How it works ↓</a>
    </div>

    <div class="hero-stats" id="heroStats">
      <div class="hero-stat">
        <span class="stat-value">340+</span>
        <span class="stat-label">Franchises</span>
      </div>
      <div class="hero-stat">
        <span class="stat-value">4,800+</span>
        <span class="stat-label">Entries mapped</span>
      </div>
      <div class="hero-stat">
        <span class="stat-value">2</span>
        <span class="stat-label">Orders per guide</span>
      </div>
      <div class="hero-stat">
        <span class="stat-value">100%</span>
        <span class="stat-label">Spoiler free</span>
      </div>
    </div>
  </div>

  <div class="hero-vertical-label" id="verticalLabel">
    <span>WATCH · ORDER · GUIDE · 340+ FRANCHISES</span>
  </div>

  <div class="scroll-indicator" id="scrollIndicator">
    <div class="scroll-line"></div>
    <span>Scroll</span>
  </div>
</section>

<!-- Ticker -->
<div class="ticker">
  <div class="ticker-track">
    <span class="ticker-item">MCU<span class="ticker-sep">✦</span></span>
    <span class="ticker-item">STAR WARS<span class="ticker-sep">✦</span></span>
    <span class="ticker-item">DRAGON BALL<span class="ticker-sep">✦</span></span>
    <span class="ticker-item">JOHN WICK<span class="ticker-sep">✦</span></span>
    <span class="ticker-item">DUNE<span class="ticker-sep">✦</span></span>
    <span class="ticker-item">BATMAN<span class="ticker-sep">✦</span></span>
    <span class="ticker-item">ONE PIECE<span class="ticker-sep">✦</span></span>
    <span class="ticker-item">WITCHER<span class="ticker-sep">✦</span></span>
    <span class="ticker-item">INDIANA JONES<span class="ticker-sep">✦</span></span>
    <span class="ticker-item">FAST & FURIOUS<span class="ticker-sep">✦</span></span>
    <span class="ticker-item">MISSION IMPOSSIBLE<span class="ticker-sep">✦</span></span>
    <span class="ticker-item">JAMES BOND<span class="ticker-sep">✦</span></span>
    <span class="ticker-item">ALIEN<span class="ticker-sep">✦</span></span>
    <span class="ticker-item">PREDATOR<span class="ticker-sep">✦</span></span>
    <span class="ticker-item">JURASSIC PARK<span class="ticker-sep">✦</span></span>
    <span class="ticker-item">TERMINATOR<span class="ticker-sep">✦</span></span>
  </div>
</div>

<!-- Franchises Section -->
<section class="franchises-section">
  <div class="section-header">
    <div>
      <div class="section-overtitle">
        <span class="overtitle-bar"></span>
        <span>Featured Guides</span>
      </div>
      <h2 class="section-title">The franchises<br /><em>everyone gets lost in.</em></h2>
    </div>
    <a href="/franchises" class="view-all-link">View all 340+ franchises →</a>
  </div>

  <div class="franchise-list">
    <div class="franchise-row">
      <div class="franchise-left">
        <span class="franchise-idx">01</span>
        <div><span class="franchise-type">FILM FRANCHISE</span><span class="franchise-years">2008–2024</span></div>
      </div>
      <div class="franchise-center">
        <span class="franchise-title">Marvel Cinematic Universe</span>
        <p class="franchise-desc">5 phases. 33 entries. One universe that changed cinema forever.</p>
      </div>
      <div class="franchise-right">
        <span class="franchise-entries">33 entries</span>
        <span class="label lbl-amber">ESSENTIAL</span>
        <svg class="franchise-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 10h14M11 5l5 5-5 5" stroke="currentColor" stroke-width="1.4"/></svg>
      </div>
    </div>

    <div class="franchise-row">
      <div class="franchise-left">
        <span class="franchise-idx">02</span>
        <div><span class="franchise-type">SAGA</span><span class="franchise-years">1977–2024</span></div>
      </div>
      <div class="franchise-center">
        <span class="franchise-title">Star Wars</span>
        <p class="franchise-desc">The saga that defined a generation. Release order vs. timeline — finally solved.</p>
      </div>
      <div class="franchise-right">
        <span class="franchise-entries">18 entries</span>
        <span class="label lbl-blue">COMPLEX</span>
        <svg class="franchise-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 10h14M11 5l5 5-5 5" stroke="currentColor" stroke-width="1.4"/></svg>
      </div>
    </div>

    <div class="franchise-row">
      <div class="franchise-left">
        <span class="franchise-idx">03</span>
        <div><span class="franchise-type">ANIME FRANCHISE</span><span class="franchise-years">1986–2024</span></div>
      </div>
      <div class="franchise-center">
        <span class="franchise-title">Dragon Ball</span>
        <p class="franchise-desc">From DB to Super. Every arc, every transformation, every skip guide.</p>
      </div>
      <div class="franchise-right">
        <span class="franchise-entries">21 entries</span>
        <span class="label lbl-amber">ESSENTIAL</span>
        <svg class="franchise-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 10h14M11 5l5 5-5 5" stroke="currentColor" stroke-width="1.4"/></svg>
      </div>
    </div>

    <div class="franchise-row">
      <div class="franchise-left">
        <span class="franchise-idx">04</span>
        <div><span class="franchise-type">FILM FRANCHISE</span><span class="franchise-years">2014–2023</span></div>
      </div>
      <div class="franchise-center">
        <span class="franchise-title">John Wick</span>
        <p class="franchise-desc">A clean linear saga. Watch in order. No exceptions.</p>
      </div>
      <div class="franchise-right">
        <span class="franchise-entries">5 entries</span>
        <span class="label lbl-green">LINEAR</span>
        <svg class="franchise-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 10h14M11 5l5 5-5 5" stroke="currentColor" stroke-width="1.4"/></svg>
      </div>
    </div>

    <div class="franchise-row">
      <div class="franchise-left">
        <span class="franchise-idx">05</span>
        <div><span class="franchise-type">SERIES</span><span class="franchise-years">2019–2024</span></div>
      </div>
      <div class="franchise-center">
        <span class="franchise-title">The Witcher</span>
        <p class="franchise-desc">Non-linear timelines across multiple series, films and spin-offs.</p>
      </div>
      <div class="franchise-right">
        <span class="franchise-entries">8 entries</span>
        <span class="label lbl-blue">COMPLEX</span>
        <svg class="franchise-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 10h14M11 5l5 5-5 5" stroke="currentColor" stroke-width="1.4"/></svg>
      </div>
    </div>
  </div>
</section>

<!-- Split Section -->
<section class="split-section">
  <div class="split-container">
    <div class="split-side">
      <div class="split-badge bad">WITHOUT WATCHORDER</div>
      <h3 class="split-title">The chaos<br /><em>of starting blind.</em></h3>
      <div class="split-list">
        <div class="split-item bad"><span class="split-icon">✗</span><span>Reddit threads with 47 conflicting opinions</span></div>
        <div class="split-item bad"><span class="split-icon">✗</span><span>Accidentally watching a sequel first</span></div>
        <div class="split-item bad"><span class="split-icon">✗</span><span>Major spoilers in watch order guides</span></div>
        <div class="split-item bad"><span class="split-icon">✗</span><span>No idea which films are skippable</span></div>
        <div class="split-item bad"><span class="split-icon">✗</span><span>Wasting 2 hours on filler you did not need</span></div>
        <div class="split-item bad"><span class="split-icon">✗</span><span>Release order vs timeline — zero clarity</span></div>
      </div>
    </div>

    <div class="split-divider">
      <div class="divider-line"></div>
      <div class="divider-circle">VS</div>
      <div class="divider-line"></div>
    </div>

    <div class="split-side">
      <div class="split-badge good">WITH WATCHORDER</div>
      <h3 class="split-title">The clarity<br /><em>of knowing exactly.</em></h3>
      <div class="split-list">
        <div class="split-item good"><span class="split-icon">✓</span><span>One definitive guide. Curated by humans.</span></div>
        <div class="split-item good"><span class="split-icon">✓</span><span>Release order and story timeline separated</span></div>
        <div class="split-item good"><span class="split-icon">✓</span><span>Zero spoilers in every entry note</span></div>
        <div class="split-item good"><span class="split-icon">✓</span><span>Every entry labeled — Essential, Optional, Skip</span></div>
        <div class="split-item good"><span class="split-icon">✓</span><span>Know exactly what to skip and why</span></div>
        <div class="split-item good"><span class="split-icon">✓</span><span>Crystal clear. Instant decisions. No regrets.</span></div>
      </div>
    </div>
  </div>
</section>

<!-- Features Section -->
<section class="features-section" id="how">
  <div class="features-container">
    <div class="features-tabs">
      <div class="section-overtitle">
        <span class="overtitle-bar"></span>
        <span>What We Do</span>
      </div>
      <h2 class="section-title">Built for<br /><em>franchise fans.</em></h2>
      
      <div class="feature-tab active" id="tab1">
        <span class="tab-number">01</span>
        <div class="tab-content">
          <span class="tab-title">Two orders. One guide.</span>
          <span class="tab-sub">Release order vs story timeline — clearly separated, never confused.</span>
        </div>
        <div class="tab-bar"></div>
      </div>

      <div class="feature-tab" id="tab2">
        <span class="tab-number">02</span>
        <div class="tab-content">
          <span class="tab-title">Every entry is labeled.</span>
          <span class="tab-sub">Essential, Optional, Skip, or Watch Last — curated by humans.</span>
        </div>
        <div class="tab-bar"></div>
      </div>

      <div class="feature-tab" id="tab3">
        <span class="tab-number">03</span>
        <div class="tab-content">
          <span class="tab-title">No spoilers. Just clarity.</span>
          <span class="tab-sub">Context without ruining what comes next.</span>
        </div>
        <div class="tab-bar"></div>
      </div>

      <div class="feature-tab" id="tab4">
        <span class="tab-number">04</span>
        <div class="tab-content">
          <span class="tab-title">Movies. Series. Anime.</span>
          <span class="tab-sub">Every franchise type — one platform.</span>
        </div>
        <div class="tab-bar"></div>
      </div>
    </div>

    <div class="features-display">
      <div class="feature-panel active" id="panel1">
        <div class="feature-image">
          <img src="https://image.tmdb.org/t/p/w780/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg" alt="Two orders">
          <div class="feature-image-overlay"></div>
          <div class="feature-image-number">01</div>
        </div>
        <h3 class="feature-title">Two orders. One guide.</h3>
        <p class="feature-detail">Every franchise guide shows you both the order films were released AND the in-universe chronological order. Toggle between them instantly. Know the difference. Choose your path.</p>
      </div>

      <div class="feature-panel" id="panel2">
        <div class="feature-image">
          <img src="https://i.redd.it/f46xrb44ysn81.jpg" alt="Labels">
          <div class="feature-image-overlay"></div>
          <div class="feature-image-number">02</div>
        </div>
        <h3 class="feature-title">Every entry is labeled.</h3>
        <p class="feature-detail">No algorithm. No automation. Every single entry in every franchise is reviewed and labeled by our curators. You will always know exactly what matters and what you can skip.</p>
      </div>

      <div class="feature-panel" id="panel3">
        <div class="feature-image">
          <img src="https://wallpapers.com/images/hd/dragon-ball-z-4z6kt1zztr1mlz9q.jpg" alt="No spoilers">
          <div class="feature-image-overlay"></div>
          <div class="feature-image-number">03</div>
        </div>
        <h3 class="feature-title">No spoilers. Just clarity.</h3>
        <p class="feature-detail">Each entry includes a brief spoiler-free note explaining why it matters, what it sets up, and whether skipping it affects your understanding. Intelligence without ruining the experience.</p>
      </div>

      <div class="feature-panel" id="panel4">
        <div class="feature-image">
          <img src="https://image.tmdb.org/t/p/w780/fZPSd91yGE9fCcCe6OoQr6E3Bev.jpg" alt="All types">
          <div class="feature-image-overlay"></div>
          <div class="feature-image-number">04</div>
        </div>
        <h3 class="feature-title">Movies. Series. Anime.</h3>
        <p class="feature-detail">MCU to Monsterverse. Star Wars to Star Trek. Dragon Ball to One Piece. We cover film franchises, TV series, and anime with the same obsessive level of curation across all of them.</p>
      </div>
    </div>
  </div>
</section>

<!-- Guide Section -->
<section class="guide-section">
  <div class="guide-container">
    <div class="guide-left">
      <div class="section-overtitle">
        <span class="overtitle-bar"></span>
        <span>Live Example</span>
      </div>
      <h2 class="section-title">This is what<br /><em>clarity looks like.</em></h2>
      <p class="guide-desc">Every guide on WatchOrder looks like this. Two order options. Every entry labeled. Brief spoiler-free context. Nothing more, nothing less.</p>
      <div class="guide-toggles">
        <button class="toggle-btn active">Release Order</button>
        <button class="toggle-btn">Story Timeline</button>
      </div>
      <a href="/franchise/marvel-cinematic-universe" class="btn-primary" style="margin-top: 32px; display: inline-flex;">
        <span>Open Full MCU Guide</span>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" stroke-width="1.4"/></svg>
      </a>
    </div>

    <div class="guide-panel">
      <div class="guide-header">
        <div class="guide-header-left">
          <img src="https://image.tmdb.org/t/p/w92/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg" alt="" class="guide-thumb">
          <div>
            <div class="guide-title">Marvel Cinematic Universe</div>
            <div class="guide-meta">33 entries · Phase 1–5 · 2008–2024</div>
          </div>
        </div>
        <span class="label lbl-amber">ESSENTIAL</span>
      </div>

      <div class="guide-progress">
        <div class="progress-fill" style="width: 18%"></div>
        <span class="progress-label">Phase 1 of 5</span>
      </div>

      <div class="guide-entries">
        <div class="guide-entry">
          <div class="entry-left">
            <span class="entry-number">01</span>
            <div class="entry-dot-wrapper">
              <div class="entry-dot lbl-amber"></div>
              <div class="entry-connector"></div>
            </div>
          </div>
          <div class="entry-content">
            <div class="entry-row">
              <span class="entry-title">Iron Man</span>
              <span class="entry-year">2008</span>
              <span class="entry-time">2h 6m</span>
            </div>
            <p class="entry-note">The genesis. Do not skip under any circumstances.</p>
          </div>
          <span class="label lbl-amber">ESSENTIAL</span>
        </div>

        <div class="guide-entry">
          <div class="entry-left">
            <span class="entry-number">02</span>
            <div class="entry-dot-wrapper">
              <div class="entry-dot lbl-amber"></div>
              <div class="entry-connector"></div>
            </div>
          </div>
          <div class="entry-content">
            <div class="entry-row">
              <span class="entry-title">The Incredible Hulk</span>
              <span class="entry-year">2008</span>
              <span class="entry-time">1h 52m</span>
            </div>
            <p class="entry-note">Loosely tied in. Hulk is recast immediately after.</p>
          </div>
          <span class="label lbl-blue">OPTIONAL</span>
        </div>

        <div class="guide-entry">
          <div class="entry-left">
            <span class="entry-number">03</span>
            <div class="entry-dot-wrapper">
              <div class="entry-dot lbl-amber"></div>
              <div class="entry-connector"></div>
            </div>
          </div>
          <div class="entry-content">
            <div class="entry-row">
              <span class="entry-title">Iron Man 2</span>
              <span class="entry-year">2010</span>
              <span class="entry-time">2h 4m</span>
            </div>
            <p class="entry-note">Introduces Black Widow and Nick Fury properly.</p>
          </div>
          <span class="label lbl-amber">ESSENTIAL</span>
        </div>

        <div class="guide-entry">
          <div class="entry-left">
            <span class="entry-number">04</span>
            <div class="entry-dot-wrapper">
              <div class="entry-dot lbl-amber"></div>
              <div class="entry-connector"></div>
            </div>
          </div>
          <div class="entry-content">
            <div class="entry-row">
              <span class="entry-title">Thor</span>
              <span class="entry-year">2011</span>
              <span class="entry-time">1h 55m</span>
            </div>
            <p class="entry-note">Introduces the Tesseract. Sets up Infinity Stones.</p>
          </div>
          <span class="label lbl-amber">ESSENTIAL</span>
        </div>

        <div class="guide-entry">
          <div class="entry-left">
            <span class="entry-number">05</span>
            <div class="entry-dot-wrapper">
              <div class="entry-dot lbl-amber"></div>
              <div class="entry-connector"></div>
            </div>
          </div>
          <div class="entry-content">
            <div class="entry-row">
              <span class="entry-title">Captain America: The First Avenger</span>
              <span class="entry-year">2011</span>
              <span class="entry-time">2h 4m</span>
            </div>
            <p class="entry-note">Essential origin. Directly leads into The Avengers.</p>
          </div>
          <span class="label lbl-amber">ESSENTIAL</span>
        </div>

        <div class="guide-entry">
          <div class="entry-left">
            <span class="entry-number">06</span>
            <div class="entry-dot-wrapper">
              <div class="entry-dot lbl-amber"></div>
            </div>
          </div>
          <div class="entry-content">
            <div class="entry-row">
              <span class="entry-title">The Avengers</span>
              <span class="entry-year">2012</span>
              <span class="entry-time">2h 23m</span>
            </div>
            <p class="entry-note">Phase 1 finale. The payoff for everything before it.</p>
          </div>
          <span class="label lbl-amber">ESSENTIAL</span>
        </div>
      </div>

      <div class="guide-footer">
        <span>Showing 6 of 33 entries</span>
        <a href="/franchise/marvel-cinematic-universe">See all 33 →</a>
      </div>
    </div>
  </div>
</section>

<script>
// Hero animation and cursor tracking
(function() {
  const nav = document.getElementById('mainNav');
  const line1 = document.getElementById('line1');
  const line2 = document.getElementById('line2');
  const line3 = document.getElementById('line3');
  const line4 = document.getElementById('line4');
  const line5 = document.getElementById('line5');
  const heroSubtitle = document.getElementById('heroSubtitle');
  const heroActions = document.getElementById('heroActions');
  const heroStats = document.getElementById('heroStats');
  const verticalLabel = document.getElementById('verticalLabel');
  const scrollIndicator = document.getElementById('scrollIndicator');
  const customDot = document.getElementById('customDot');
  const customRing = document.getElementById('customRing');

  let cursor = { x: 0, y: 0, vx: 0, vy: 0 };
  let lastCursor = { x: 0, y: 0 };
  let scrollY = 0;

  // Show hero elements sequentially
  setTimeout(() => {
    nav.classList.add('nav-visible');
  }, 50);

  setTimeout(() => {
    line1.classList.add('hero-visible');
  }, 150);
  setTimeout(() => {
    line2.classList.add('hero-visible');
  }, 250);
  setTimeout(() => {
    line3.classList.add('hero-visible');
  }, 350);
  setTimeout(() => {
    line4.classList.add('hero-visible');
  }, 450);
  setTimeout(() => {
    line5.classList.add('hero-visible');
  }, 550);
  setTimeout(() => {
    heroSubtitle.classList.add('hero-visible');
  }, 650);
  setTimeout(() => {
    heroActions.classList.add('hero-visible');
  }, 750);
  setTimeout(() => {
    heroStats.classList.add('hero-visible');
  }, 850);
  setTimeout(() => {
    verticalLabel.classList.add('hero-visible');
    scrollIndicator.classList.add('hero-visible');
  }, 950);

  // Cursor tracking
  function throttle(fn, delay) {
    let lastCall = 0;
    return (...args) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        fn(...args);
      }
    };
  }

  function handleMouseMove(e) {
    cursor = {
      x: e.clientX,
      y: e.clientY,
      vx: e.clientX - lastCursor.x,
      vy: e.clientY - lastCursor.y
    };
    lastCursor = { x: e.clientX, y: e.clientY };
    
    customDot.style.left = cursor.x + 'px';
    customDot.style.top = cursor.y + 'px';
    customRing.style.left = cursor.x + 'px';
    customRing.style.top = cursor.y + 'px';
    customRing.style.transform = `translate(-50%, -50%) rotate(${Math.atan2(cursor.vy, cursor.vx) * 180 / Math.PI}deg)`;
  }

  function handleScroll() {
    scrollY = window.scrollY;
    nav.classList.toggle('nav-scrolled', scrollY > 60);
  }

  window.addEventListener('mousemove', throttle(handleMouseMove, 16));
  window.addEventListener('scroll', throttle(handleScroll, 16));
  
  // Hide cursor when leaving window
  window.addEventListener('mouseleave', () => {
    customDot.style.opacity = '0';
    customRing.style.opacity = '0';
  });
  window.addEventListener('mouseenter', () => {
    customDot.style.opacity = '1';
    customRing.style.opacity = '1';
  });

  // Feature tabs
  const tabs = [
    { tab: document.getElementById('tab1'), panel: document.getElementById('panel1') },
    { tab: document.getElementById('tab2'), panel: document.getElementById('panel2') },
    { tab: document.getElementById('tab3'), panel: document.getElementById('panel3') },
    { tab: document.getElementById('tab4'), panel: document.getElementById('panel4') }
  ];

  tabs.forEach((item, idx) => {
    if (item.tab) {
      item.tab.addEventListener('click', () => {
        tabs.forEach(t => {
          t.tab.classList.remove('active');
          t.panel.classList.remove('active');
        });
        item.tab.classList.add('active');
        item.panel.classList.add('active');
      });
    }
  });
})();
</script>

</body>
</html>