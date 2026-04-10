<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WatchOrder — Cinematic Oracle</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Mono:wght@300;400;500&family=Outfit:wght@200;300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{
  --gold:#D4A843;--gold2:#F0C96A;--gold-dim:rgba(212,168,67,0.13);
  --cream:#F2EDE0;--ink:#08070B;--ink2:#100F15;--ink3:#18161D;
  --border:rgba(242,237,224,0.07);--red:#C94040;--teal:#3DA68A;
}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
html{scroll-behavior:smooth;}
body{background:var(--ink);color:var(--cream);font-family:'Outfit',sans-serif;overflow-x:hidden;min-height:100vh;}
body::before{
  content:'';position:fixed;inset:0;z-index:1000;pointer-events:none;opacity:.028;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size:200px 200px;
}
#bg{position:fixed;inset:0;z-index:0;pointer-events:none;}
.sprocket{position:fixed;top:0;bottom:0;width:28px;z-index:2;pointer-events:none;display:flex;flex-direction:column;align-items:center;overflow:hidden;}
.sprocket.left{left:0;border-right:1px solid rgba(242,237,224,0.04);}
.sprocket.right{right:0;border-left:1px solid rgba(242,237,224,0.04);}
.sprocket-hole{width:14px;height:20px;border-radius:3px;flex-shrink:0;border:1.5px solid rgba(242,237,224,0.06);margin:9px 0;}
nav{position:fixed;top:0;left:0;right:0;z-index:500;padding:22px 64px;display:flex;justify-content:space-between;align-items:center;transition:background .4s,padding .4s,border-color .4s;border-bottom:1px solid transparent;}
nav.scrolled{background:rgba(8,7,11,0.93);backdrop-filter:blur(24px);border-bottom-color:rgba(212,168,67,0.1);padding:13px 64px;}
.logo{display:flex;align-items:baseline;cursor:pointer;gap:0;}
.logo-W{font-family:'Playfair Display',serif;font-size:2.4rem;font-weight:900;color:var(--gold);line-height:1;text-shadow:0 0 30px rgba(212,168,67,0.4);}
.logo-atch{font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:400;color:var(--cream);}
.logo-Order{font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:700;font-style:italic;color:var(--cream);opacity:.9;}
.logo-dot{width:7px;height:7px;border-radius:50%;background:var(--gold);margin-left:7px;margin-bottom:4px;align-self:flex-end;box-shadow:0 0 10px var(--gold),0 0 20px rgba(212,168,67,0.5);animation:pulse 2.5s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}
.nav-right{display:flex;align-items:center;gap:14px;}
.nav-tag{font-family:'DM Mono',monospace;font-size:.62rem;letter-spacing:.22em;color:var(--gold);opacity:.75;background:var(--gold-dim);border:1px solid rgba(212,168,67,.18);padding:6px 16px;border-radius:40px;}
.nav-guide-btn{font-family:'DM Mono',monospace;font-size:.62rem;letter-spacing:.15em;color:rgba(242,237,224,.55);background:rgba(242,237,224,.04);border:1px solid rgba(242,237,224,.1);padding:6px 18px;border-radius:40px;cursor:pointer;transition:color .2s,border-color .2s;display:flex;align-items:center;gap:7px;}
.nav-guide-btn:hover{color:var(--gold);border-color:rgba(212,168,67,.3);}
.nav-watchlist{font-family:'DM Mono',monospace;font-size:.62rem;letter-spacing:.15em;color:var(--gold);background:rgba(212,168,67,.1);border:1px solid rgba(212,168,67,.3);padding:6px 18px;border-radius:40px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:7px;}
.nav-watchlist:hover{background:rgba(212,168,67,.2);transform:translateY(-2px);}
#app{min-height:100vh;padding:130px 0 100px;position:relative;z-index:10;}
.view{animation:fadeUp .5s cubic-bezier(.2,.9,.4,1) both;}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.hero{text-align:center;max-width:860px;margin:0 auto;padding:0 40px 64px;}
.eyebrow{display:inline-flex;align-items:center;gap:14px;font-family:'DM Mono',monospace;font-size:.68rem;letter-spacing:.26em;color:var(--gold);margin-bottom:30px;}
.eyebrow::before,.eyebrow::after{content:'';width:36px;height:1px;background:var(--gold);display:block;}
.hero-title{font-family:'Playfair Display',serif;font-size:clamp(3rem,6.5vw,5.6rem);font-weight:900;line-height:.93;letter-spacing:-.03em;margin-bottom:28px;}
.hero-title em{font-style:italic;font-weight:400;background:linear-gradient(135deg,var(--gold),var(--gold2),var(--gold));background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 5s linear infinite;}
@keyframes shimmer{to{background-position:200% center}}
.hero-sub{font-size:1rem;line-height:1.75;color:rgba(242,237,224,.38);max-width:540px;margin:0 auto;}
.type-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;max-width:1120px;margin:0 auto;padding:0 44px;}
.type-card{position:relative;overflow:hidden;background:var(--ink2);border:1px solid var(--border);border-radius:22px;padding:46px 30px 38px;cursor:pointer;text-align:left;transition:transform .38s cubic-bezier(.2,.9,.4,1),border-color .3s,box-shadow .38s;isolation:isolate;}
.type-card::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--c-accent,var(--gold)),transparent);transform:scaleX(0);transition:transform .4s cubic-bezier(.2,.9,.4,1);}
.type-card:hover::after{transform:scaleX(1);}
.type-card::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 110%,var(--c-glow,rgba(212,168,67,.1)) 0%,transparent 65%);opacity:0;transition:opacity .35s;}
.type-card:hover::before{opacity:1;}
.type-card:hover{transform:translateY(-13px) scale(1.01);border-color:var(--c-accent,var(--gold));box-shadow:0 28px 60px rgba(0,0,0,.55),0 0 40px var(--c-shadow,rgba(212,168,67,.12));}
.type-card[data-t="movies"]{--c-accent:#D4A843;--c-glow:rgba(212,168,67,.1);--c-shadow:rgba(212,168,67,.14);}
.type-card[data-t="anime"]{--c-accent:#E8836A;--c-glow:rgba(232,131,106,.1);--c-shadow:rgba(232,131,106,.14);}
.type-card[data-t="series"]{--c-accent:#3DA68A;--c-glow:rgba(61,166,138,.1);--c-shadow:rgba(61,166,138,.14);}
.card-num{font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.2em;color:rgba(242,237,224,.2);margin-bottom:26px;}
.card-icon{font-size:3.4rem;display:block;line-height:1;margin-bottom:22px;transition:transform .3s cubic-bezier(.34,1.56,.64,1);}
.type-card:hover .card-icon{transform:scale(1.14) rotate(-4deg);}
.card-title{font-family:'Playfair Display',serif;font-size:1.75rem;font-weight:700;letter-spacing:-.01em;margin-bottom:12px;}
.card-desc{font-size:.84rem;line-height:1.65;color:rgba(242,237,224,.38);margin-bottom:32px;}
.card-cta{position:absolute;bottom:26px;right:26px;font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.12em;color:rgba(242,237,224,.25);display:flex;align-items:center;gap:5px;transition:color .2s,transform .2s;}
.type-card:hover .card-cta{color:var(--c-accent,var(--gold));transform:translateX(5px);}
.q-wrap{max-width:820px;margin:0 auto;padding:0 32px;}
.back-btn{display:inline-flex;align-items:center;gap:8px;font-family:'DM Mono',monospace;font-size:.65rem;letter-spacing:.12em;color:rgba(242,237,224,.4);background:transparent;border:1px solid rgba(242,237,224,.09);border-radius:40px;padding:9px 20px;cursor:pointer;margin-bottom:40px;transition:color .2s,border-color .2s,transform .2s;}
.back-btn:hover{color:var(--gold);border-color:rgba(212,168,67,.35);transform:translateX(-4px);}
.progress-bar{height:2px;background:rgba(242,237,224,.06);border-radius:2px;margin-bottom:52px;overflow:visible;position:relative;}
.progress-fill{height:100%;background:linear-gradient(90deg,var(--gold),var(--gold2));border-radius:2px;transition:width .6s cubic-bezier(.2,.9,.4,1);position:relative;}
.progress-fill::after{content:'';position:absolute;right:-3px;top:50%;transform:translateY(-50%);width:8px;height:8px;border-radius:50%;background:var(--gold2);box-shadow:0 0 10px var(--gold),0 0 22px rgba(212,168,67,.6);}
.q-card{background:var(--ink2);border:1px solid var(--border);border-radius:24px;padding:54px 50px;position:relative;overflow:hidden;}
.q-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(212,168,67,.25),transparent);}
.q-step{font-family:'DM Mono',monospace;font-size:.66rem;letter-spacing:.2em;color:var(--gold);margin-bottom:16px;}
.q-text{font-family:'Playfair Display',serif;font-size:clamp(1.7rem,2.8vw,2.5rem);font-weight:700;line-height:1.15;letter-spacing:-.01em;margin-bottom:10px;}
.q-hint{font-family:'DM Mono',monospace;font-size:.63rem;letter-spacing:.08em;color:rgba(242,237,224,.32);margin-bottom:34px;}
.chips{display:flex;flex-wrap:wrap;gap:11px;margin-bottom:28px;}
.chip{display:inline-flex;align-items:center;gap:6px;font-family:'Outfit',sans-serif;font-size:.88rem;background:rgba(242,237,224,.03);border:1px solid rgba(242,237,224,.09);border-radius:40px;padding:10px 20px;cursor:pointer;transition:background .2s,border-color .2s,color .2s,transform .15s;user-select:none;}
.chip:hover{border-color:rgba(212,168,67,.4);transform:translateY(-2px);background:rgba(212,168,67,.06);}
.chip.selected{background:rgba(212,168,67,.14);border-color:var(--gold);color:var(--gold);}
.chip.selected::after{content:'✓';font-size:.7rem;font-weight:700;}
.opts{display:grid;grid-template-columns:repeat(2,1fr);gap:13px;}
.opt{display:flex;justify-content:space-between;align-items:center;background:rgba(242,237,224,.02);border:1px solid rgba(242,237,224,.08);border-radius:14px;padding:16px 22px;font-family:'Outfit',sans-serif;font-size:.93rem;color:var(--cream);cursor:pointer;text-align:left;transition:background .2s,border-color .2s,transform .2s;position:relative;overflow:hidden;}
.opt::before{content:'';position:absolute;left:-100%;top:0;bottom:0;width:100%;background:linear-gradient(90deg,transparent,rgba(212,168,67,.07),transparent);transition:left .4s;}
.opt:hover::before{left:100%;}
.opt:hover{background:rgba(212,168,67,.07);border-color:rgba(212,168,67,.38);transform:translateX(6px);}
.opt-arr{opacity:0;color:var(--gold);transition:opacity .15s,transform .15s;flex-shrink:0;}
.opt:hover .opt-arr{opacity:1;transform:translateX(3px);}
.q-footer{display:flex;justify-content:space-between;align-items:center;margin-top:6px;gap:12px;}
.genre-count{font-family:'DM Mono',monospace;font-size:.65rem;color:rgba(242,237,224,.32);letter-spacing:.1em;}
.genre-next{display:inline-flex;align-items:center;gap:9px;background:linear-gradient(135deg,var(--gold),#B8922A);color:var(--ink);border:none;border-radius:50px;padding:13px 30px;font-family:'DM Mono',monospace;font-size:.7rem;letter-spacing:.12em;font-weight:700;cursor:pointer;transition:transform .2s,box-shadow .2s,opacity .2s;}
.genre-next:disabled{opacity:.3;cursor:not-allowed;transform:none!important;}
.genre-next:not(:disabled):hover{transform:translateY(-3px);box-shadow:0 10px 28px rgba(212,168,67,.3);}
.search-container{position:relative;margin-bottom:28px;}
.search-input{width:100%;background:rgba(242,237,224,.05);border:1px solid rgba(242,237,224,.15);border-radius:60px;padding:16px 24px;font-size:1rem;color:var(--cream);font-family:'Outfit',sans-serif;outline:none;transition:border-color .2s;}
.search-input:focus{border-color:var(--gold);}
.search-results{position:absolute;top:100%;left:0;right:0;background:var(--ink2);border:1px solid var(--border);border-radius:16px;max-height:300px;overflow-y:auto;z-index:100;margin-top:8px;}
.search-item{display:flex;align-items:center;gap:12px;padding:12px 20px;cursor:pointer;transition:background .2s;border-bottom:1px solid rgba(242,237,224,.05);}
.search-item:hover{background:rgba(212,168,67,.1);}
.search-poster{width:40px;height:60px;object-fit:cover;border-radius:6px;background:var(--ink3);}
.search-info{flex:1;}
.search-title{font-weight:500;margin-bottom:4px;}
.search-year{font-size:.75rem;color:rgba(242,237,224,.45);font-family:'DM Mono',monospace;}
.selected-title{background:rgba(212,168,67,.1);border:1px solid var(--gold);border-radius:40px;padding:10px 20px;display:inline-flex;align-items:center;gap:12px;margin-bottom:20px;}
.clear-selected{background:none;border:none;color:var(--gold);cursor:pointer;font-size:1.2rem;}
.skip-btn{background:transparent;border:1px solid rgba(242,237,224,.2);border-radius:40px;padding:12px 24px;font-family:'DM Mono',monospace;font-size:.7rem;color:rgba(242,237,224,.5);cursor:pointer;transition:all .2s;}
.skip-btn:hover{border-color:var(--gold);color:var(--gold);}
.loader{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:52vh;gap:24px;text-align:center;padding:60px;}
.loader-ring{width:66px;height:66px;border-radius:50%;border:1.5px solid rgba(212,168,67,.12);border-top-color:var(--gold);animation:spin .85s linear infinite;}
@keyframes spin{to{transform:rotate(360deg)}}
.loader-dots{display:flex;gap:8px;}
.loader-dots span{width:7px;height:7px;border-radius:50%;background:var(--gold);animation:dot 1.4s infinite ease-in-out both;}
.loader-dots span:nth-child(2){animation-delay:.16s}
.loader-dots span:nth-child(3){animation-delay:.32s}
@keyframes dot{0%,80%,100%{transform:scale(.2);opacity:.15}40%{transform:scale(1);opacity:1}}
.loader-label{font-family:'DM Mono',monospace;font-size:.75rem;letter-spacing:.18em;color:var(--gold);transition:opacity .3s;}
.loader-sub{font-family:'DM Mono',monospace;font-size:.62rem;letter-spacing:.1em;color:rgba(242,237,224,.3);}
.rec-wrap{max-width:1180px;margin:0 auto;padding:0 50px;}
.rec-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;gap:20px;flex-wrap:wrap;}
.rec-counter{font-family:'DM Mono',monospace;font-size:.68rem;letter-spacing:.15em;color:rgba(242,237,224,.38);}
.counter-dots{display:flex;gap:8px;align-items:center;margin-top:10px;}
.cdot{width:8px;height:8px;border-radius:50%;background:rgba(242,237,224,.18);cursor:pointer;transition:all .3s ease;}
.cdot.on{background:var(--gold);width:22px;border-radius:4px;box-shadow:0 0 10px rgba(212,168,67,.5);}
.cdot:hover:not(.on){background:rgba(212,168,67,.45);}
.rec-card{display:grid;grid-template-columns:290px 1fr;background:var(--ink2);border:1px solid var(--border);border-radius:24px;overflow:hidden;position:relative;transition:border-color .3s;}
.rec-card:hover{border-color:rgba(212,168,67,.15);}
.rec-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(212,168,67,.22),transparent);z-index:1;}
.poster-col{position:relative;overflow:hidden;min-height:510px;background:var(--ink3);display:flex;align-items:center;justify-content:center;}
.poster-img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0;transition:transform .6s cubic-bezier(.2,.9,.4,1);}
.rec-card:hover .poster-img{transform:scale(1.05);}
.poster-shade{position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(8,7,11,.85) 100%);}
.poster-score{position:absolute;top:16px;right:16px;z-index:2;background:rgba(8,7,11,.82);backdrop-filter:blur(12px);border:1px solid rgba(212,168,67,.28);border-radius:14px;padding:10px 14px;text-align:center;}
.score-num{font-family:'Playfair Display',serif;font-size:1.55rem;font-weight:900;color:var(--gold);line-height:1;display:block;}
.score-lbl{font-family:'DM Mono',monospace;font-size:.52rem;letter-spacing:.12em;color:rgba(242,237,224,.4);}
.no-poster{font-size:4rem;opacity:.1;}
.info-col{padding:46px 42px 40px;display:flex;flex-direction:column;}
.rec-badge{display:inline-flex;align-items:center;gap:8px;font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.2em;color:var(--gold);background:var(--gold-dim);border:1px solid rgba(212,168,67,.2);border-radius:40px;padding:6px 16px;margin-bottom:18px;width:fit-content;}
.rec-title{font-family:'Playfair Display',serif;font-size:clamp(1.9rem,3.2vw,2.9rem);font-weight:900;line-height:.95;letter-spacing:-.02em;margin-bottom:10px;}
.rec-tagline{font-family:'Playfair Display',serif;font-style:italic;font-weight:400;font-size:.98rem;color:rgba(242,237,224,.35);margin-bottom:22px;line-height:1.5;}
.meta-row{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:18px;}
.pill{font-family:'DM Mono',monospace;font-size:.64rem;padding:6px 14px;border-radius:40px;background:rgba(242,237,224,.04);border:1px solid rgba(242,237,224,.08);}
.genres-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;}
.gtag{font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.1em;padding:5px 13px;border-radius:40px;background:rgba(212,168,67,.08);border:1px solid rgba(212,168,67,.2);color:var(--gold);}
.info-hr{width:100%;height:1px;background:linear-gradient(90deg,rgba(212,168,67,.18),transparent);margin:18px 0;}
.rec-overview{font-size:.92rem;line-height:1.78;color:rgba(242,237,224,.52);flex:1;margin-bottom:18px;}
.crew{font-size:.82rem;color:rgba(242,237,224,.38);margin-bottom:8px;}
.crew strong{color:rgba(242,237,224,.72);}
.actions{display:flex;gap:14px;margin-top:auto;padding-top:10px;}
.act-btn{display:inline-flex;align-items:center;gap:9px;padding:13px 26px;border-radius:50px;cursor:pointer;font-family:'DM Mono',monospace;font-size:.68rem;letter-spacing:.1em;font-weight:500;transition:all .22s ease;border:none;}
.act-reject{background:transparent;border:1px solid rgba(242,237,224,.11);color:rgba(242,237,224,.55);}
.act-reject:hover{border-color:var(--red);color:var(--red);transform:translateX(-4px);}
.act-accept{background:linear-gradient(135deg,var(--gold),#B5901E);color:var(--ink);font-weight:700;flex:1;justify-content:center;}
.act-accept:hover{background:linear-gradient(135deg,var(--gold2),var(--gold));transform:translateY(-4px);box-shadow:0 12px 32px rgba(212,168,67,.28);}
#toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(90px);background:var(--ink2);border:1px solid rgba(212,168,67,.28);border-radius:50px;padding:13px 28px;font-family:'DM Mono',monospace;font-size:.7rem;letter-spacing:.12em;color:var(--gold);z-index:9000;display:flex;align-items:center;gap:9px;box-shadow:0 20px 50px rgba(0,0,0,.5);transition:transform .42s cubic-bezier(.2,.9,.4,1);pointer-events:none;}
#toast.show{transform:translateX(-50%) translateY(0);}
.empty{text-align:center;padding:80px 30px;max-width:520px;margin:0 auto;}
.empty h3{font-family:'Playfair Display',serif;font-size:2.2rem;font-weight:700;margin-bottom:16px;}
.empty p{color:rgba(242,237,224,.4);font-size:.9rem;line-height:1.7;margin-bottom:32px;}
.guide-wrap{max-width:800px;margin:0 auto;padding:0 40px;}
.guide-wrap h2{font-family:'Playfair Display',serif;font-size:2.8rem;font-weight:900;margin-bottom:8px;}
.guide-wrap h2 em{font-style:italic;font-weight:400;background:linear-gradient(135deg,var(--gold),var(--gold2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.guide-sub{color:rgba(242,237,224,.38);font-size:.9rem;margin-bottom:48px;line-height:1.6;}
.franchise-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:24px;margin-top:32px;}
.franchise-card{background:var(--ink2);border:1px solid var(--border);border-radius:20px;padding:24px;cursor:pointer;transition:transform .25s,border-color .25s;display:flex;flex-direction:column;gap:12px;}
.franchise-card:hover{border-color:rgba(212,168,67,.35);transform:translateY(-6px);}
.franchise-name{font-family:'Playfair Display',serif;font-size:1.35rem;font-weight:700;}
.franchise-meta{font-family:'DM Mono',monospace;font-size:.62rem;letter-spacing:.1em;color:rgba(242,237,224,.45);}
.franchise-count{color:var(--gold);font-size:.75rem;margin-top:8px;}
.franchise-arr{margin-top:12px;font-size:.8rem;color:var(--gold);opacity:.6;transition:opacity .2s,transform .2s;}
.franchise-card:hover .franchise-arr{opacity:1;transform:translateX(5px);}
.franchise-order{display:flex;flex-direction:column;gap:12px;margin-top:32px;}
.order-item{background:var(--ink2);border:1px solid var(--border);border-radius:14px;padding:20px 26px;display:flex;align-items:flex-start;gap:18px;}
.order-num{font-family:'DM Mono',monospace;font-size:1.1rem;font-weight:500;color:var(--gold);opacity:.55;min-width:26px;flex-shrink:0;}
.order-title{font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:700;margin-bottom:4px;}
.order-note{font-size:.82rem;color:rgba(242,237,224,.38);}

/* WATCHLIST STYLES */
.watchlist-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:24px;margin-top:40px;}
.watchlist-item{background:var(--ink2);border:1px solid var(--border);border-radius:16px;overflow:hidden;cursor:pointer;transition:transform .25s,border-color .25s;}
.watchlist-item:hover{transform:translateY(-6px);border-color:rgba(212,168,67,.3);}
.watchlist-poster{position:relative;aspect-ratio:2/3;overflow:hidden;background:var(--ink3);}
.watchlist-poster img{width:100%;height:100%;object-fit:cover;transition:transform .4s;}
.watchlist-item:hover .watchlist-poster img{transform:scale(1.05);}
.watchlist-badge{position:absolute;top:10px;right:10px;font-family:'DM Mono',monospace;font-size:.5rem;letter-spacing:.1em;padding:4px 8px;border-radius:20px;background:rgba(0,0,0,.7);color:var(--gold);border:1px solid rgba(212,168,67,.3);}
.watchlist-info{padding:16px;}
.watchlist-title{font-family:'Playfair Display',serif;font-size:1rem;font-weight:700;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.watchlist-meta{display:flex;justify-content:space-between;font-size:.7rem;color:rgba(242,237,224,.45);margin-bottom:12px;}
.watchlist-rating{color:var(--gold);}
.watchlist-remove{width:100%;background:transparent;border:1px solid rgba(242,237,224,.15);border-radius:30px;padding:8px;font-size:.65rem;font-family:'DM Mono',monospace;cursor:pointer;transition:all .2s;color:rgba(242,237,224,.5);margin-top:8px;}
.watchlist-remove:hover{border-color:var(--red);color:var(--red);}

/* MODAL STYLES */
.modal-overlay{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.95);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:40px;animation:fadeIn .3s ease;}
.modal-overlay.closing{animation:fadeOut .25s ease forwards;}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes fadeOut{from{opacity:1}to{opacity:0}}
.modal-container{max-width:900px;width:100%;max-height:85vh;background:var(--ink2);border:1px solid rgba(212,168,67,.2);border-radius:24px;overflow:hidden;display:flex;flex-direction:column;animation:slideUp .35s cubic-bezier(.2,.9,.4,1);}
@keyframes slideUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
.modal-header{position:relative;height:280px;overflow:hidden;flex-shrink:0;}
.modal-bg{position:absolute;inset:0;background-size:cover;background-position:center;filter:blur(0) brightness(0.4);transform:scale(1.05);}
.modal-header-content{position:relative;z-index:2;padding:24px;display:flex;gap:24px;height:100%;align-items:flex-end;}
.modal-poster{width:140px;border-radius:12px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,.5);border:1px solid rgba(212,168,67,.3);}
.modal-poster img{width:100%;height:auto;display:block;}
.modal-title-info{flex:1;padding-bottom:16px;}
.modal-title{font-family:'Playfair Display',serif;font-size:2.2rem;font-weight:900;margin-bottom:8px;line-height:1.1;}
.modal-tagline{font-family:'Playfair Display',serif;font-style:italic;font-size:.9rem;color:rgba(242,237,224,.45);margin-bottom:12px;}
.modal-badges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;}
.modal-badge{font-family:'DM Mono',monospace;font-size:.55rem;letter-spacing:.1em;padding:4px 12px;border-radius:20px;background:rgba(212,168,67,.1);border:1px solid rgba(212,168,67,.3);color:var(--gold);}
.modal-close{position:absolute;top:16px;right:16px;z-index:10;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.2);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.2rem;transition:all .2s;}
.modal-close:hover{background:var(--gold);color:var(--ink);border-color:var(--gold);}
.modal-body{overflow-y:auto;padding:24px 32px;flex:1;}
.modal-section{margin-bottom:28px;}
.modal-section-title{font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.2em;color:var(--gold);margin-bottom:12px;display:flex;align-items:center;gap:10px;}
.modal-section-title::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,var(--gold),transparent);}
.modal-overview{font-size:.9rem;line-height:1.7;color:rgba(242,237,224,.7);}
.modal-meta-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;}
.modal-meta-item{background:rgba(255,255,255,.03);border-radius:10px;padding:12px;}
.modal-meta-label{font-family:'DM Mono',monospace;font-size:.55rem;color:rgba(242,237,224,.4);margin-bottom:4px;}
.modal-meta-value{font-size:.85rem;color:var(--cream);}
.modal-genres{display:flex;flex-wrap:wrap;gap:8px;}
.modal-genre{font-family:'DM Mono',monospace;font-size:.6rem;padding:5px 12px;border-radius:20px;background:rgba(212,168,67,.08);border:1px solid rgba(212,168,67,.2);color:var(--gold);}
.modal-cast{display:flex;flex-wrap:wrap;gap:12px;}
.modal-cast-item{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.03);border-radius:10px;padding:8px 16px;min-width:160px;}
.modal-cast-name{font-size:.8rem;font-weight:500;}
.modal-cast-character{font-size:.65rem;color:rgba(242,237,224,.45);}
.modal-actions{display:flex;gap:12px;margin-top:20px;}
.modal-watchlist-btn{background:linear-gradient(135deg,var(--gold),#B8922A);border:none;border-radius:40px;padding:12px 24px;font-family:'DM Mono',monospace;font-size:.7rem;font-weight:700;color:var(--ink);cursor:pointer;transition:transform .2s;display:flex;align-items:center;gap:8px;}
.modal-watchlist-btn:hover{transform:translateY(-2px);}
.modal-watchlist-btn.in-watchlist{background:rgba(212,168,67,.2);border:1px solid var(--gold);color:var(--gold);}
::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-track{background:var(--ink);}
::-webkit-scrollbar-thumb{background:rgba(212,168,67,.28);border-radius:3px;}
@media(max-width:920px){
  .type-grid{grid-template-columns:1fr;max-width:440px;}
  nav,nav.scrolled{padding:16px 24px;}
  .opts{grid-template-columns:1fr;}
  .q-card{padding:34px 26px;}
  .rec-card{grid-template-columns:1fr;}
  .poster-col{min-height:300px;}
  .info-col{padding:28px 24px;}
  .rec-wrap{padding:0 20px;}
  .q-wrap{padding:0 20px;}
  .hero{padding:0 24px 50px;}
  .type-grid{padding:0 24px;}
  .guide-wrap{padding:0 24px;}
  .nav-tag,.nav-watchlist span{display:none;}
  .modal-header{height:auto;min-height:200px;}
  .modal-header-content{flex-direction:column;align-items:flex-start;gap:12px;padding:16px;}
  .modal-poster{width:80px;}
  .modal-title{font-size:1.5rem;}
  .watchlist-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px;}
}
</style>
</head>
<body>
<canvas id="bg"></canvas>
<div class="sprocket left" id="sL"></div>
<div class="sprocket right" id="sR"></div>
<nav id="nav">
  <div class="logo" id="logo-home">
    <span class="logo-W">W</span><span class="logo-atch">atch</span><span class="logo-Order">Order</span>
    <div class="logo-dot"></div>
  </div>
  <div class="nav-right">
    <button class="nav-watchlist" id="watchlist-btn">📋 <span>WATCHLIST</span></button>
    <button class="nav-guide-btn" id="guide-btn">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
      <span>GUIDES</span>
    </button>
    <div class="nav-tag">✦ CINEMATIC ORACLE ✦</div>
  </div>
</nav>
<main id="app"></main>
<div id="toast">✦ <span id="toast-msg"></span></div>
<script>
(function(){
'use strict';
const TMDB='https://api.themoviedb.org/3';
const KEY='175b19b3ba717bf4f24e37ee4325be7e';
const IMG='https://image.tmdb.org/t/p/';

// WATCHLIST STORAGE
let watchlist = JSON.parse(localStorage.getItem('watchorder_watchlist') || '[]');
function saveWatchlist(){localStorage.setItem('watchorder_watchlist',JSON.stringify(watchlist));}
function addToWatchlist(item){
  if(!watchlist.some(w=>w.id===item.id && w.media_type===item.media_type)){
    watchlist.push({...item,addedAt:Date.now()});
    saveWatchlist();
    showToast(`✨ "${item.title}" added to watchlist`);
    if(S.step==='watchlist') render();
    return true;
  }
  showToast(`📌 "${item.title}" is already in your watchlist`);
  return false;
}
function removeFromWatchlist(id,media_type){
  watchlist=watchlist.filter(w=>!(w.id===id && w.media_type===media_type));
  saveWatchlist();
  showToast(`🗑 Removed from watchlist`);
  if(S.step==='watchlist') render();
}
function isInWatchlist(id,media_type){
  return watchlist.some(w=>w.id===id && w.media_type===media_type);
}

/* CANVAS */
const cv=document.getElementById('bg'),cx=cv.getContext('2d');
let W,H;
function resize(){W=cv.width=innerWidth;H=cv.height=innerHeight;}
resize();addEventListener('resize',resize);
const orbs=[
  {rx:.12,ry:.18,sz:500,c:'rgba(212,168,67,0.09)',dx:.00015,dy:.0001},
  {rx:.88,ry:.8,sz:560,c:'rgba(201,64,64,0.07)',dx:-.0001,dy:.00012},
  {rx:.5,ry:.5,sz:420,c:'rgba(61,166,138,0.06)',dx:.00013,dy:-.0001},
  {rx:.25,ry:.78,sz:360,c:'rgba(138,111,196,0.06)',dx:.00009,dy:.00015},
];
const pts=Array.from({length:55},()=>({x:Math.random()*1500,y:Math.random()*900,vx:(Math.random()-.5)*.14,vy:(Math.random()-.5)*.14,r:Math.random()*1.4+.3,a:Math.random()*.35+.05}));
let T=0;
(function frame(){
  cx.clearRect(0,0,W,H);
  orbs.forEach((o,i)=>{
    const x=(o.rx+Math.sin(T*o.dx+i)*.06)*W,y=(o.ry+Math.cos(T*o.dy+i)*.05)*H;
    const g=cx.createRadialGradient(x,y,0,x,y,o.sz);
    g.addColorStop(0,o.c);g.addColorStop(1,'transparent');
    cx.fillStyle=g;cx.beginPath();cx.arc(x,y,o.sz,0,Math.PI*2);cx.fill();
  });
  pts.forEach(p=>{
    cx.beginPath();cx.arc(p.x%W,p.y%H,p.r,0,Math.PI*2);
    cx.fillStyle=`rgba(212,168,67,${p.a})`;cx.fill();
    p.x+=p.vx;p.y+=p.vy;
    if(p.x<0)p.x+=W;if(p.x>W)p.x-=W;if(p.y<0)p.y+=H;if(p.y>H)p.y-=H;
  });
  T++;requestAnimationFrame(frame);
})();

['sL','sR'].forEach(id=>{const el=document.getElementById(id);for(let i=0;i<70;i++){const h=document.createElement('div');h.className='sprocket-hole';el.appendChild(h);}});

const navEl=document.getElementById('nav');
addEventListener('scroll',()=>navEl.classList.toggle('scrolled',scrollY>40));

const MOVIE_GENRES={
  'Action':28,'Adventure':12,'Animation':16,'Comedy':35,'Crime':80,'Documentary':99,
  'Drama':18,'Family':10751,'Fantasy':14,'History':36,'Horror':27,'Music':10402,
  'Mystery':9648,'Romance':10749,'Science Fiction':878,'Thriller':53,'War':10752,'Western':37
};

// 8 QUESTIONS (removed runtime)
const MOVIE_QS=[
  {id:'genres',text:'What genres call to you?',hint:'Select 1 to 3 — they will be combined',type:'multi',maxPick:3,
   opts:['Action','Adventure','Animation','Comedy','Crime','Documentary','Drama','Family','Fantasy','History','Horror','Music','Mystery','Romance','Science Fiction','Thriller','War','Western']},
  {id:'era',text:'Which era of cinema?',hint:'Choose the time period you want to explore',type:'single',
   opts:[
     {label:'Right Now — 2020 to 2025',years:[2020,2025]},{label:'Golden Age — 2010 to 2019',years:[2010,2019]},
     {label:'New Millennium — 2000 to 2009',years:[2000,2009]},{label:'The 90s — 1990 to 1999',years:[1990,1999]},
     {label:'Vintage — 1980 to 1989',years:[1980,1989]},{label:'Classic — 1970 to 1979',years:[1970,1979]},
     {label:'Golden Hollywood — before 1970',years:[1920,1969]},
   ]},
  {id:'quality',text:'How picky are you feeling?',hint:'Sets the minimum TMDB audience rating',type:'single',
   opts:[{label:'8.0+ — Absolute masterpieces only',min:8.0},{label:'7.0+ — Great, well-loved films',min:7.0},
         {label:'6.0+ — Solid, enjoyable picks',min:6.0},{label:'Anything goes — chaos mode',min:0}]},
  {id:'language',text:'Original language?',hint:'Filter by the film\'s native language',type:'single',
   opts:[{label:'English',lang:'en'},{label:'Korean',lang:'ko'},{label:'Japanese',lang:'ja'},{label:'French',lang:'fr'},
         {label:'Spanish',lang:'es'},{label:'German',lang:'de'},{label:'Italian',lang:'it'},{label:'Hindi',lang:'hi'},{label:'Any language',lang:'any'}]},
  {id:'certification',text:'MPAA rating?',hint:'US rating system — G to NC-17',type:'single',
   opts:[{label:'Any rating',code:'any'},{label:'G — General Audiences',code:'G'},{label:'PG — Parental Guidance',code:'PG'},
         {label:'PG-13 — Parents Strongly Cautioned',code:'PG-13'},{label:'R — Restricted',code:'R'},{label:'NC-17 — Adults Only',code:'NC-17'}]},
  {id:'sort',text:'How to rank results?',hint:'What matters most to you?',type:'single',
   opts:[{label:'Highest rated first',sort:'vote_average.desc'},{label:'Most popular first',sort:'popularity.desc'},
         {label:'Newest first',sort:'primary_release_date.desc'},{label:'Oldest first',sort:'primary_release_date.asc'}]},
  {id:'votes',text:'Minimum votes?',hint:'Higher = more consensus',type:'single',
   opts:[{label:'Any (10+ votes)',minV:10},{label:'Moderate (100+ votes)',minV:100},{label:'Popular (500+ votes)',minV:500},{label:'Very popular (1000+ votes)',minV:1000}]},
  {id:'similar',text:'Name a movie you absolutely loved (optional)',hint:'We\'ll find similar titles — skip if you want',type:'similar',skipable:true}
];

const ANIME_QS=[
  {id:'genres',text:'Choose your anime flavour',hint:'Select 1 to 3 genres',type:'multi',maxPick:3,
   opts:['Action','Adventure','Comedy','Drama','Fantasy','Horror','Mystery','Romance','Sci-Fi','Slice of Life','Sports']},
  {id:'era',text:'Which era of anime?',hint:'',type:'single',
   opts:[{label:'Modern — 2018 to 2025',years:[2018,2025]},{label:'Peak era — 2010 to 2017',years:[2010,2017]},
         {label:'Classics — 2000 to 2009',years:[2000,2009]},{label:'Vintage — before 2000',years:[1980,1999]}]},
  {id:'quality',text:'Quality threshold',hint:'',type:'single',
   opts:[{label:'8.0+ — The absolute best',min:8.0},{label:'7.0+ — Great anime',min:7.0},{label:'6.0+ — Solid picks',min:6.0},{label:'Anything goes',min:0}]},
  {id:'sort',text:'How to rank?',hint:'',type:'single',
   opts:[{label:'Highest rated first',sort:'vote_average.desc'},{label:'Most popular first',sort:'popularity.desc'},
         {label:'Newest first',sort:'first_air_date.desc'},{label:'Oldest first',sort:'first_air_date.asc'}]},
  {id:'votes',text:'Popularity level?',hint:'',type:'single',
   opts:[{label:'Hidden gems (20+ votes)',minV:20},{label:'Cult (200+ votes)',minV:200},{label:'Popular (1000+ votes)',minV:1000},{label:'No preference',minV:10}]},
  {id:'similar',text:'Name an anime you absolutely loved (optional)',hint:'We\'ll find similar titles — skip if you want',type:'similar',skipable:true}
];

const SERIES_QS=[
  {id:'genres',text:'What kind of series?',hint:'Select 1 to 3 genres',type:'multi',maxPick:3,
   opts:['Action & Adventure','Comedy','Crime','Documentary','Drama','Family','Horror','Mystery','Romance','Sci-Fi & Fantasy','Thriller','War & Politics','Western']},
  {id:'era',text:'Which era of television?',hint:'',type:'single',
   opts:[{label:'Streaming Age — 2018 to 2025',years:[2018,2025]},{label:'Peak TV — 2010 to 2017',years:[2010,2017]},
         {label:'Golden Age — 2000 to 2009',years:[2000,2009]},{label:'Classic TV — 1990 to 1999',years:[1990,1999]},
         {label:'Vintage — before 1990',years:[1950,1989]}]},
  {id:'quality',text:'How high are your standards?',hint:'',type:'single',
   opts:[{label:'8.0+ — Emmy-winning quality',min:8.0},{label:'7.0+ — Critically acclaimed',min:7.0},
         {label:'6.0+ — Fun and enjoyable',min:6.0},{label:'Anything goes',min:0}]},
  {id:'sort',text:'How to rank?',hint:'',type:'single',
   opts:[{label:'Highest rated first',sort:'vote_average.desc'},{label:'Most popular first',sort:'popularity.desc'},
         {label:'Newest first',sort:'first_air_date.desc'},{label:'Oldest first',sort:'first_air_date.asc'}]},
  {id:'votes',text:'Popularity level?',hint:'',type:'single',
   opts:[{label:'Hidden gems (30+ votes)',minV:30},{label:'Cult (300+ votes)',minV:300},{label:'Acclaimed (3000+ votes)',minV:3000},{label:'No preference',minV:10}]},
  {id:'similar',text:'Name a series you absolutely loved (optional)',hint:'We\'ll find similar titles — skip if you want',type:'similar',skipable:true}
];

// FRANCHISES DATA
const FRANCHISES=[
  {name:'Marvel Cinematic Universe',icon:'⚡',count:'33 films + shows',desc:'The complete, definitive watch order for the entire MCU.',
   order:[{n:1,title:'Iron Man (2008)',year:2008},{n:2,title:'The Incredible Hulk (2008)',year:2008},{n:3,title:'Iron Man 2 (2010)',year:2010},{n:4,title:'Thor (2011)',year:2011},{n:5,title:'Captain America: The First Avenger (2011)',year:2011},{n:6,title:'The Avengers (2012)',year:2012},{n:7,title:'Iron Man 3 (2013)',year:2013},{n:8,title:'Thor: The Dark World (2013)',year:2013},{n:9,title:'Captain America: The Winter Soldier (2014)',year:2014},{n:10,title:'Guardians of the Galaxy (2014)',year:2014},{n:11,title:'Avengers: Age of Ultron (2015)',year:2015},{n:12,title:'Ant-Man (2015)',year:2015},{n:13,title:'Captain America: Civil War (2016)',year:2016},{n:14,title:'Doctor Strange (2016)',year:2016},{n:15,title:'Guardians of the Galaxy Vol. 2 (2017)',year:2017},{n:16,title:'Spider-Man: Homecoming (2017)',year:2017},{n:17,title:'Thor: Ragnarok (2017)',year:2017},{n:18,title:'Black Panther (2018)',year:2018},{n:19,title:'Avengers: Infinity War (2018)',year:2018},{n:20,title:'Ant-Man and the Wasp (2018)',year:2018},{n:21,title:'Captain Marvel (2019)',year:2019},{n:22,title:'Avengers: Endgame (2019)',year:2019},{n:23,title:'Spider-Man: Far From Home (2019)',year:2019}]},
  {name:'Star Wars (Chronological)',icon:'⭐',count:'12 films + shows',desc:'The galaxy far, far away in true story timeline order.',
   order:[{n:1,title:'The Phantom Menace (1999)',year:1999},{n:2,title:'Attack of the Clones (2002)',year:2002},{n:3,title:'The Clone Wars (2008–2020)',year:2008},{n:4,title:'Revenge of the Sith (2005)',year:2005},{n:5,title:'Solo: A Star Wars Story (2018)',year:2018},{n:6,title:'Rogue One (2016)',year:2016},{n:7,title:'A New Hope (1977)',year:1977},{n:8,title:'The Empire Strikes Back (1980)',year:1980},{n:9,title:'Return of the Jedi (1983)',year:1983},{n:10,title:'The Mandalorian (2019)',year:2019},{n:11,title:'The Force Awakens (2015)',year:2015},{n:12,title:'The Last Jedi (2017)',year:2017},{n:13,title:'The Rise of Skywalker (2019)',year:2019}]},
  {name:'The Dark Knight Trilogy',icon:'🦇',count:'3 films',desc:'Christopher Nolan\'s definitive, grounded take on Batman.',
   order:[{n:1,title:'Batman Begins (2005)',year:2005},{n:2,title:'The Dark Knight (2008)',year:2008},{n:3,title:'The Dark Knight Rises (2012)',year:2012}]},
  {name:'John Wick',icon:'🐶',count:'4 films',desc:'The most stylized action franchise.',
   order:[{n:1,title:'John Wick (2014)',year:2014},{n:2,title:'John Wick: Chapter 2 (2017)',year:2017},{n:3,title:'John Wick: Chapter 3 – Parabellum (2019)',year:2019},{n:4,title:'John Wick: Chapter 4 (2023)',year:2023}]},
  {name:'Lord of the Rings + Hobbit',icon:'💍',count:'6 films',desc:'Watch LOTR first, then The Hobbit.',
   order:[{n:1,title:'The Fellowship of the Ring (2001)',year:2001},{n:2,title:'The Two Towers (2002)',year:2002},{n:3,title:'The Return of the King (2003)',year:2003},{n:4,title:'The Hobbit: An Unexpected Journey (2012)',year:2012},{n:5,title:'The Hobbit: The Desolation of Smaug (2013)',year:2013},{n:6,title:'The Hobbit: The Battle of the Five Armies (2014)',year:2014}]},
  {name:'Neon Genesis Evangelion',icon:'🤖',count:'TV series + 5 films',desc:'The definitive watch order for the complete NGE experience.',
   order:[{n:1,title:'Neon Genesis Evangelion (1995–96)',year:1995},{n:2,title:'The End of Evangelion (1997)',year:1997},{n:3,title:'Evangelion: 1.11 (2007)',year:2007},{n:4,title:'Evangelion: 2.22 (2009)',year:2009},{n:5,title:'Evangelion: 3.33 (2012)',year:2012},{n:6,title:'Evangelion: 3.0+1.11 (2021)',year:2021}]},
  {name:'Breaking Bad Universe',icon:'🧪',count:'2 series + film',desc:'The complete story of the ABQ drug empire.',
   order:[{n:1,title:'Better Call Saul (2015–2022)',year:2015},{n:2,title:'Breaking Bad (2008–2013)',year:2008},{n:3,title:'El Camino (2019)',year:2019}]},
];

/* STATE */
let S={step:'type',type:null,questions:[],qIdx:0,answers:{},recs:[],recIdx:0,selectedFranchise:null,similarTitle:null};

/* ROUTER */
const app=document.getElementById('app');
function go(step,extra={}){
  if(step==='type') S={step:'type',type:null,questions:[],qIdx:0,answers:{},recs:[],recIdx:0,selectedFranchise:null,similarTitle:null};
  else Object.assign(S,{step},extra);
  render();
  scrollTo({top:0,behavior:'smooth'});
}
document.getElementById('logo-home').onclick=()=>go('type');
document.getElementById('guide-btn').onclick=()=>{ S.selectedFranchise=null; go('guides'); };
document.getElementById('watchlist-btn').onclick=()=>{ go('watchlist'); };

function render(){
  app.innerHTML='';
  const v=document.createElement('div');v.className='view';app.appendChild(v);
  ({type:()=>renderType(v),questions:()=>renderQ(v),loading:()=>renderLoad(v),recs:()=>renderRecs(v),guides:()=>renderGuides(v),watchlist:()=>renderWatchlist(v)}[S.step]||renderType)(v);
}

function renderType(el){
  el.innerHTML=`
  <div class="hero"><div class="eyebrow">THE CINEMATIC ORACLE</div>
  <h1 class="hero-title">Discover your<br/><em>next obsession</em></h1>
  <p class="hero-sub">Answer 8 questions. The oracle searches TMDB's library of over 500,000 titles and surfaces the perfect match.</p></div>
  <div class="type-grid">
    <div class="type-card" data-t="movies"><div class="card-num">01 — FILM</div><span class="card-icon">🎬</span><div class="card-title">Motion Pictures</div><div class="card-desc">Cinematic masterpieces, cult classics, and undiscovered gems from every corner of the world.</div><div class="card-cta">BEGIN <span>→</span></div></div>
    <div class="type-card" data-t="anime"><div class="card-num">02 — ANIMATION</div><span class="card-icon">🌸</span><div class="card-title">Japanese Anime</div><div class="card-desc">From Studio Ghibli to shōnen epics — the absolute finest the medium has to offer.</div><div class="card-cta">BEGIN <span>→</span></div></div>
    <div class="type-card" data-t="series"><div class="card-num">03 — EPISODIC</div><span class="card-icon">📺</span><div class="card-title">TV Series</div><div class="card-desc">Prestige dramas, binge-worthy comedies, and the greatest episodic storytelling ever made.</div><div class="card-cta">BEGIN <span>→</span></div></div>
  </div>`;
  el.querySelectorAll('.type-card').forEach(c=>{
    c.onclick=()=>{
      const t=c.dataset.t;
      S.type=t;
      S.questions=t==='movies'?MOVIE_QS:t==='anime'?ANIME_QS:SERIES_QS;
      S.qIdx=0;S.answers={};S.similarTitle=null;
      go('questions');
    };
  });
}

function renderQ(el){
  const q=S.questions[S.qIdx];
  const prog=((S.qIdx+1)/S.questions.length)*100;
  const wrap=document.createElement('div');wrap.className='q-wrap';
  wrap.innerHTML=`
    <button class="back-btn" id="back-q">← Back</button>
    <div class="progress-bar"><div class="progress-fill" id="pfill" style="width:0%"></div></div>
    <div class="q-card">
      <div class="q-step">✦ CHAPTER ${S.qIdx+1} OF ${S.questions.length} ✦</div>
      <h2 class="q-text">${esc(q.text)}</h2>
      ${q.hint?`<div class="q-hint">${esc(q.hint)}</div>`:''}
      <div id="q-body"></div>
      ${q.type==='multi'?`<div class="q-footer"><span class="genre-count" id="gcount">0 / ${q.maxPick} selected</span><button class="genre-next" id="gnext" disabled>CONTINUE →</button></div>`:''}
      ${q.type==='similar'?`<div class="q-footer"><button class="genre-next" id="similar-continue" disabled>CONTINUE →</button><button class="skip-btn" id="skip-similar">SKIP</button></div>`:''}
    </div>`;
  el.appendChild(wrap);
  setTimeout(()=>{const f=document.getElementById('pfill');if(f)f.style.width=prog+'%';},60);
  const body=wrap.querySelector('#q-body');

  if(q.type==='multi'){
    const cd=document.createElement('div');cd.className='chips';
    let sel=S.answers[q.id]||[];
    q.opts.forEach(opt=>{
      const ch=document.createElement('button');ch.className='chip';ch.textContent=opt;
      if(sel.includes(opt))ch.classList.add('selected');
      ch.onclick=()=>{
        const idx=sel.indexOf(opt);
        if(idx>=0){sel.splice(idx,1);ch.classList.remove('selected');}
        else if(sel.length<q.maxPick){sel.push(opt);ch.classList.add('selected');}
        const gc=document.getElementById('gcount');if(gc)gc.textContent=`${sel.length} / ${q.maxPick} selected`;
        const nb=document.getElementById('gnext');if(nb)nb.disabled=sel.length===0;
      };
      cd.appendChild(ch);
    });
    body.appendChild(cd);
    const nb=wrap.querySelector('#gnext');
    if(nb)nb.onclick=()=>{S.answers[q.id]=sel;advance();};
    const gc=document.getElementById('gcount');if(gc)gc.textContent=`${sel.length} / ${q.maxPick} selected`;
    if(nb)nb.disabled=sel.length===0;
  } 
  else if(q.type==='similar'){
    const container=document.createElement('div');
    container.innerHTML=`
      <div class="search-container">
        <input type="text" class="search-input" id="similar-search" placeholder="Search for a title... (e.g., Inception, Spirited Away, Breaking Bad)" autocomplete="off">
        <div id="search-results" class="search-results" style="display:none"></div>
      </div>
      <div id="selected-display"></div>
    `;
    body.appendChild(container);
    const searchInput=container.querySelector('#similar-search');
    const resultsDiv=container.querySelector('#search-results');
    const selectedDiv=container.querySelector('#selected-display');
    const continueBtn=wrap.querySelector('#similar-continue');
    let debounceTimer;
    
    function updateContinueBtn(){
      if(continueBtn) continueBtn.disabled = !S.similarTitle;
    }
    
    if(S.similarTitle){
      selectedDiv.innerHTML=`<div class="selected-title">🎬 ${esc(S.similarTitle.title)} (${S.similarTitle.year||'?'}) <button class="clear-selected" id="clear-selected">✕</button></div>`;
      document.getElementById('clear-selected')?.addEventListener('click',()=>{S.similarTitle=null;selectedDiv.innerHTML='';searchInput.value='';updateContinueBtn();});
      updateContinueBtn();
    }
    
    searchInput.addEventListener('input',()=>{
      clearTimeout(debounceTimer);
      const query=searchInput.value.trim();
      if(query.length<2){resultsDiv.style.display='none';return;}
      debounceTimer=setTimeout(async()=>{
        const isMovieType=S.type==='movies';
        const searchUrl=`${TMDB}/search/${isMovieType?'movie':'tv'}?api_key=${KEY}&query=${encodeURIComponent(query)}&page=1`;
        try{
          const res=await fetch(searchUrl).then(r=>r.json());
          resultsDiv.innerHTML='';
          if(res.results?.length){
            res.results.slice(0,6).forEach(item=>{
              const div=document.createElement('div');div.className='search-item';
              div.innerHTML=`
                <img class="search-poster" src="${item.poster_path?IMG+'w92'+item.poster_path:'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23D4A843\'%3E%3Crect width=\'24\' height=\'36\' fill=\'%23100F15\'/%3E%3C/svg%3E'}">
                <div class="search-info"><div class="search-title">${esc(isMovieType?item.title:item.name)}</div><div class="search-year">${(isMovieType?item.release_date:item.first_air_date||'').slice(0,4)||'TBA'}</div></div>
              `;
              div.onclick=()=>{
                S.similarTitle={id:item.id,title:isMovieType?item.title:item.name,year:(isMovieType?item.release_date:item.first_air_date||'').slice(0,4),media_type:isMovieType?'movie':'tv'};
                selectedDiv.innerHTML=`<div class="selected-title">🎬 ${esc(S.similarTitle.title)} (${S.similarTitle.year||'?'}) <button class="clear-selected" id="clear-selected">✕</button></div>`;
                document.getElementById('clear-selected')?.addEventListener('click',()=>{S.similarTitle=null;selectedDiv.innerHTML='';searchInput.value='';updateContinueBtn();});
                resultsDiv.style.display='none';
                searchInput.value='';
                updateContinueBtn();
              };
              resultsDiv.appendChild(div);
            });
            resultsDiv.style.display='block';
          } else {resultsDiv.style.display='none';}
        }catch(e){resultsDiv.style.display='none';}
      },400);
    });
    document.addEventListener('click',(e)=>{if(!container.contains(e.target))resultsDiv.style.display='none';});
    const skipBtn=wrap.querySelector('#skip-similar');
    if(skipBtn)skipBtn.onclick=()=>{S.similarTitle=null;advance();};
    if(continueBtn)continueBtn.onclick=()=>{if(S.similarTitle)advance();};
    updateContinueBtn();
  }
  else {
    const od=document.createElement('div');od.className='opts';
    q.opts.forEach(opt=>{
      const btn=document.createElement('button');btn.className='opt';
      btn.innerHTML=`<span>${esc(opt.label)}</span><span class="opt-arr">→</span>`;
      btn.onclick=()=>{S.answers[q.id]=opt;advance();};
      od.appendChild(btn);
    });
    body.appendChild(od);
  }
  wrap.querySelector('#back-q').onclick=()=>{if(S.qIdx>0){S.qIdx--;go('questions');}else go('type');};
}

function advance(){
  if(S.qIdx<S.questions.length-1){S.qIdx++;go('questions');}
  else fetchRecs();
}

function buildURL(){
  const a=S.answers,isMovie=S.type==='movies',isAnime=S.type==='anime';
  const [y1,y2]=(a.era&&a.era.years)||[2000,2025];
  const minR=(a.quality&&a.quality.min!=null)?a.quality.min:0;
  const minV=(a.votes&&a.votes.minV!=null)?a.votes.minV:(isMovie?100:30);
  const sortBy=(a.sort&&a.sort.sort)||'vote_average.desc';
  const cert=(a.certification&&a.certification.code&&a.certification.code!=='any')?a.certification.code:null;
  
  let gids=[];
  const genreList=a.genres||[];
  if(isMovie){genreList.forEach(g=>{if(MOVIE_GENRES[g])gids.push(MOVIE_GENRES[g]);});}
  else if(isAnime){
    const ANIME_MAP={'Action':28,'Adventure':12,'Comedy':35,'Drama':18,'Fantasy':14,'Horror':27,'Mystery':9648,'Romance':10749,'Sci-Fi':878,'Slice of Life':10751,'Sports':10759};
    genreList.forEach(g=>{if(ANIME_MAP[g])gids.push(ANIME_MAP[g]);});
    gids=[...new Set(gids)];
  } else {
    const TV_MAP={'Action & Adventure':10759,'Comedy':35,'Crime':80,'Documentary':99,'Drama':18,'Family':10751,'Horror':27,'Mystery':9648,'Romance':10749,'Sci-Fi & Fantasy':10765,'Thriller':53,'War & Politics':10768,'Western':37};
    genreList.forEach(g=>{if(TV_MAP[g])gids.push(TV_MAP[g]);});
  }
  gids=[...new Set(gids)];
  
  const lang=(a.language&&a.language.lang)?a.language.lang:null;
  
  let url='';
  if(isMovie){
    const gParam=gids.length?`&with_genres=${gids.join('|')}`:'';
    const lParam=(lang&&lang!=='any')?`&with_original_language=${lang}`:'';
    const certParam=cert?`&certification_country=US&certification.lte=${cert}`:'';
    url=`${TMDB}/discover/movie?api_key=${KEY}&sort_by=${sortBy}&vote_count.gte=${minV}&primary_release_date.gte=${y1}-01-01&primary_release_date.lte=${y2}-12-31&vote_average.gte=${minR}${gParam}${lParam}${certParam}&include_adult=false&page=1`;
  } 
  else if(isAnime){
    const gParam=gids.length?`&with_genres=16|${gids.join('|')}`:'&with_genres=16';
    url=`${TMDB}/discover/tv?api_key=${KEY}&sort_by=${sortBy}&vote_count.gte=${minV}&with_original_language=ja&first_air_date.gte=${y1}-01-01&first_air_date.lte=${y2}-12-31&vote_average.gte=${minR}${gParam}&page=1`;
  } 
  else {
    const gParam=gids.length?`&with_genres=${gids.join('|')}&without_genres=16`:'&without_genres=16';
    url=`${TMDB}/discover/tv?api_key=${KEY}&sort_by=${sortBy}&vote_count.gte=${minV}&first_air_date.gte=${y1}-01-01&first_air_date.lte=${y2}-12-31&vote_average.gte=${minR}${gParam}&page=1`;
  }
  return url;
}

async function fetchRecs(){
  S.step='loading';render();
  const msgs=['Consulting the oracle…','Scanning the archives…','Summoning your vision…','Reading the stars…'];
  let mi=0;
  const iv=setInterval(()=>{
    mi=(mi+1)%msgs.length;
    const el=document.getElementById('load-msg');
    if(el){el.style.opacity=0;setTimeout(()=>{if(el){el.textContent=msgs[mi];el.style.opacity=1;}},220);}
  },1800);

  try{
    let results=[];
    const isAnime=S.type==='anime';
    
    if(isAnime){
      const tvUrl=buildURL();
      const movieUrl=buildURL().replace('/discover/tv','/discover/movie').replace(/first_air_date/g,'primary_release_date');
      const [tvRes,movieRes]=await Promise.all([
        fetch(tvUrl).then(r=>r.json()).catch(()=>({results:[]})),
        fetch(movieUrl).then(r=>r.json()).catch(()=>({results:[]}))
      ]);
      results=[...(tvRes.results||[]).map(r=>({...r,media_type:'tv'})),...(movieRes.results||[]).map(r=>({...r,media_type:'movie'}))];
    } else {
      const url=buildURL();
      const [r1,r2]=await Promise.all([
        fetch(url).then(r=>r.json()).catch(()=>({results:[]})),
        fetch(url.replace('page=1','page=2')).then(r=>r.json()).catch(()=>({results:[]}))
      ]);
      results=[...(r1.results||[]),...(r2.results||[])];
    }
    
    if(results.length<5){
      const relaxed=isAnime?buildURL().replace(/vote_average\.gte=[\d.]+/,'vote_average.gte=0'):buildURL().replace(/vote_average\.gte=[\d.]+/,'vote_average.gte=0').replace(/vote_count\.gte=\d+/,'vote_count.gte=10');
      const rr=await fetch(relaxed).then(r=>r.json()).catch(()=>({results:[]}));
      results=[...results,...(rr.results||[])];
    }
    
    const seen=new Set();
    results=results.filter(r=>{if(seen.has(r.id))return false;seen.add(r.id);return true;});
    
    if(S.similarTitle && S.similarTitle.id){
      const recUrl=`${TMDB}/${S.similarTitle.media_type}/${S.similarTitle.id}/recommendations?api_key=${KEY}&page=1`;
      const recRes=await fetch(recUrl).then(r=>r.json()).catch(()=>({results:[]}));
      const recIds=new Set(recRes.results?.slice(0,10).map(r=>r.id)||[]);
      results=results.filter(r=>recIds.has(r.id)).concat(results.filter(r=>!recIds.has(r.id)));
    }
    
    const top=results.slice(0,16);
    const isMovieType=S.type==='movies';
    const details=await Promise.all(top.map(item=>{
      const mediaType=item.media_type||(isMovieType?'movie':'tv');
      return fetch(`${TMDB}/${mediaType}/${item.id}?api_key=${KEY}&append_to_response=credits`).then(r=>r.json()).catch(()=>null);
    }));
    
    S.recs=[];
    top.forEach((item,i)=>{
      const det=details[i];
      if(!det)return;
      const mediaType=item.media_type||(isMovieType?'movie':'tv');
      S.recs.push({
        id:item.id,
        title:mediaType==='movie'?item.title:item.name,
        overview:item.overview||'No synopsis available.',
        poster:item.poster_path?IMG+'w500'+item.poster_path:'',
        rating:item.vote_average?item.vote_average.toFixed(1):'N/A',
        ratingNum:item.vote_average||0,
        votes:item.vote_count||0,
        year:(mediaType==='movie'?item.release_date:item.first_air_date||'').slice(0,4),
        genres:(det.genres||[]).slice(0,4),
        director:det.credits?.crew?.find(c=>c.job==='Director')?.name||'',
        cast:(det.credits?.cast||[]).slice(0,6).map(c=>c.name),
        tagline:det.tagline||'',
        media_type:mediaType,
        backdrop:det.backdrop_path?IMG+'w1280'+det.backdrop_path:''
      });
    });
    
    S.recs.sort((a,b)=>parseFloat(b.rating)-parseFloat(a.rating));
    S.recIdx=0;
    clearInterval(iv);
    go('recs');
  }catch(err){
    clearInterval(iv);
    console.error(err);
    app.innerHTML=`<div class="view"><div class="empty"><h3>⚠️ Oracle Offline</h3><p>Something went wrong. Please check your connection.</p><button class="back-btn" onclick="location.reload()">← Restart</button></div></div>`;
  }
}

function renderLoad(el){
  el.innerHTML=`<div class="loader"><div class="loader-ring"></div><div class="loader-dots"><span></span><span></span><span></span></div><div class="loader-label" id="load-msg">Consulting the oracle…</div><div class="loader-sub">Scanning TMDB's universe</div></div>`;
}

function renderRecs(el){
  if(!S.recs.length){
    el.innerHTML=`<div class="empty"><h3>🔮 No Visions Found</h3><p>The oracle came up empty. Try choosing a lower rating threshold or a broader date range — or pick different genres.</p><button class="back-btn" id="e-back">← Try Again</button></div>`;
    el.querySelector('#e-back').onclick=()=>go('type');
    return;
  }
  const rec=S.recs[S.recIdx];
  const isMovie=rec.media_type==='movie';
  const typeLabel=isMovie?'MOTION PICTURE':'TV SERIES';
  const dots=S.recs.map((_,i)=>`<div class="cdot${i===S.recIdx?' on':''}" data-i="${i}"></div>`).join('');
  const genreHtml=rec.genres.map(g=>`<span class="gtag">${esc(g.name)}</span>`).join('');
  const stars=rec.rating!=='N/A'?'★'.repeat(Math.min(5,Math.round(rec.rating/2)))+'☆'.repeat(Math.max(0,5-Math.round(rec.rating/2))):'';
  const wrap=document.createElement('div');wrap.className='rec-wrap';
  wrap.innerHTML=`
    <div class="rec-top"><div><button class="back-btn" id="back-r">← New Search</button><div class="rec-counter">✦ VISION ${S.recIdx+1} OF ${S.recs.length} ✦<div class="counter-dots">${dots}</div></div></div></div>
    <div class="rec-card"><div class="poster-col">${rec.poster?`<img class="poster-img" src="${esc(rec.poster)}" alt="${esc(rec.title)}" loading="lazy">`:`<div class="no-poster">🎬</div>`}<div class="poster-shade"></div><div class="poster-score"><span class="score-num">${rec.rating}</span><div class="score-lbl">${stars}</div></div></div>
    <div class="info-col"><div class="rec-badge">✦ ${typeLabel}</div><h1 class="rec-title">${esc(rec.title)}</h1>${rec.tagline?`<div class="rec-tagline">"${esc(rec.tagline)}"</div>`:''}
    <div class="meta-row"><span class="pill">📅 ${rec.year||'TBA'}</span><span class="pill">🎫 ${rec.votes.toLocaleString()} votes</span></div>
    <div class="genres-row">${genreHtml}</div><div class="info-hr"></div><p class="rec-overview">${esc(rec.overview)}</p>
    ${rec.director?`<div class="crew">🎥 Directed by <strong>${esc(rec.director)}</strong></div>`:''}
    ${rec.cast.length?`<div class="crew">🎭 Starring <strong>${rec.cast.map(esc).join(' · ')}</strong></div>`:''}
    <div class="actions"><button class="act-btn act-reject" id="btn-next"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>NEXT</button>
    <button class="act-btn act-accept" id="btn-save"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>ADD TO WATCHLIST</button></div></div></div>`;
  el.appendChild(wrap);
  wrap.querySelector('#back-r').onclick=()=>go('type');
  wrap.querySelector('#btn-next').onclick=()=>{if(S.recIdx<S.recs.length-1){S.recIdx++;go('recs');}else go('type');};
  wrap.querySelector('#btn-save').onclick=()=>addToWatchlist(rec);
  wrap.querySelectorAll('.cdot').forEach(d=>{d.onclick=()=>{S.recIdx=parseInt(d.dataset.i);go('recs');};});
}

function renderWatchlist(el){
  if(watchlist.length===0){
    el.innerHTML=`<div class="empty"><h3>📭 Your Watchlist is Empty</h3><p>Movies and shows you save will appear here. Start exploring!</p><button class="back-btn" id="wl-back">← Start Searching</button></div>`;
    el.querySelector('#wl-back').onclick=()=>go('type');
    return;
  }
  el.innerHTML=`
    <div class="hero" style="padding-bottom:20px"><div class="eyebrow">YOUR LIBRARY</div><h1 class="hero-title">Watchlist</h1><p class="hero-sub">${watchlist.length} saved ${watchlist.length===1?'title':'titles'}</p></div>
    <div class="watchlist-grid" id="watchlist-grid"></div>
    <div style="text-align:center;margin-top:40px"><button class="back-btn" id="wl-back">← Back to Oracle</button></div>
  `;
  const grid=el.querySelector('#watchlist-grid');
  watchlist.slice().reverse().forEach(item=>{
    const card=document.createElement('div');card.className='watchlist-item';
    card.innerHTML=`
      <div class="watchlist-poster">
        ${item.poster?`<img src="${item.poster}" alt="${esc(item.title)}" loading="lazy">`:`<div class="no-poster" style="font-size:3rem;display:flex;align-items:center;justify-content:center;height:100%">🎬</div>`}
        <div class="watchlist-badge">${item.media_type==='movie'?'FILM':'TV'}</div>
      </div>
      <div class="watchlist-info">
        <div class="watchlist-title">${esc(item.title)}</div>
        <div class="watchlist-meta"><span>📅 ${item.year||'TBA'}</span><span class="watchlist-rating">⭐ ${item.rating}</span></div>
        <button class="watchlist-remove" data-id="${item.id}" data-type="${item.media_type}">REMOVE</button>
      </div>
    `;
    card.querySelector('.watchlist-remove').onclick=(e)=>{e.stopPropagation();removeFromWatchlist(item.id,item.media_type);};
    card.onclick=()=>openWatchlistModal(item);
    grid.appendChild(card);
  });
  el.querySelector('#wl-back').onclick=()=>go('type');
}

async function openWatchlistModal(item){
  // Fetch full details from TMDB
  try{
    const url=`${TMDB}/${item.media_type}/${item.id}?api_key=${KEY}&append_to_response=credits`;
    const res=await fetch(url);
    const full=await res.json();
    
    const modal=document.createElement('div');modal.className='modal-overlay';
    const isMovie=item.media_type==='movie';
    const title=isMovie?full.title:full.name;
    const year=(isMovie?full.release_date:full.first_air_date||'').slice(0,4);
    const rating=full.vote_average?full.vote_average.toFixed(1):'N/A';
    const poster=full.poster_path?IMG+'w500'+full.poster_path:item.poster;
    const backdrop=full.backdrop_path?IMG+'w1280'+full.backdrop_path:item.backdrop;
    const overview=full.overview||'No synopsis available.';
    const tagline=full.tagline||'';
    const runtime=isMovie?full.runtime:full.episode_run_time?.[0];
    const genres=full.genres||[];
    const director=full.credits?.crew?.find(c=>c.job==='Director')?.name||'';
    const cast=(full.credits?.cast||[]).slice(0,8);
    const inWatchlist=isInWatchlist(item.id,item.media_type);
    
    modal.innerHTML=`
      <div class="modal-container">
        <div class="modal-header">
          <div class="modal-bg" style="background-image:url('${backdrop||poster}')"></div>
          <div class="modal-header-content">
            ${poster?`<div class="modal-poster"><img src="${poster}" alt="${esc(title)}"></div>`:''}
            <div class="modal-title-info">
              <h2 class="modal-title">${esc(title)}</h2>
              ${tagline?`<div class="modal-tagline">${esc(tagline)}</div>`:''}
              <div class="modal-badges">
                <span class="modal-badge">${isMovie?'FILM':'TV SERIES'}</span>
                <span class="modal-badge">${year||'TBA'}</span>
                ${rating!=='N/A'?`<span class="modal-badge">⭐ ${rating}/10</span>`:''}
                ${runtime?`<span class="modal-badge">⏱ ${runtime}${isMovie?' min':` min/ep`}</span>`:''}
              </div>
            </div>
          </div>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="modal-section">
            <div class="modal-section-title">SYNOPSIS</div>
            <p class="modal-overview">${esc(overview)}</p>
          </div>
          ${genres.length?`
          <div class="modal-section">
            <div class="modal-section-title">GENRES</div>
            <div class="modal-genres">${genres.map(g=>`<span class="modal-genre">${esc(g.name)}</span>`).join('')}</div>
          </div>`:''}
          <div class="modal-section">
            <div class="modal-section-title">DETAILS</div>
            <div class="modal-meta-grid">
              <div class="modal-meta-item"><div class="modal-meta-label">RELEASE DATE</div><div class="modal-meta-value">${isMovie?full.release_date||'N/A':full.first_air_date||'N/A'}</div></div>
              <div class="modal-meta-item"><div class="modal-meta-label">VOTE COUNT</div><div class="modal-meta-value">${full.vote_count?.toLocaleString()||0}</div></div>
              <div class="modal-meta-item"><div class="modal-meta-label">POPULARITY</div><div class="modal-meta-value">${Math.round(full.popularity||0)}</div></div>
              ${director?`<div class="modal-meta-item"><div class="modal-meta-label">DIRECTOR</div><div class="modal-meta-value">${esc(director)}</div></div>`:''}
            </div>
          </div>
          ${cast.length?`
          <div class="modal-section">
            <div class="modal-section-title">CAST</div>
            <div class="modal-cast">${cast.map(c=>`<div class="modal-cast-item"><span class="modal-cast-name">${esc(c.name)}</span><span class="modal-cast-character">${esc(c.character||'')}</span></div>`).join('')}</div>
          </div>`:''}
          <div class="modal-actions">
            <button class="modal-watchlist-btn ${inWatchlist?'in-watchlist':''}" id="modal-watchlist-btn">
              ${inWatchlist?'✓ IN WATCHLIST':'+ ADD TO WATCHLIST'}
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    modal.querySelector('.modal-close').onclick=()=>closeModal(modal);
    modal.onclick=(e)=>{if(e.target===modal)closeModal(modal);};
    const watchlistBtn=modal.querySelector('#modal-watchlist-btn');
    watchlistBtn.onclick=()=>{
      if(inWatchlist){
        removeFromWatchlist(item.id,item.media_type);
        watchlistBtn.textContent='+ ADD TO WATCHLIST';
        watchlistBtn.classList.remove('in-watchlist');
      } else {
        addToWatchlist({...item,title,rating,year,poster,media_type:item.media_type});
        watchlistBtn.textContent='✓ IN WATCHLIST';
        watchlistBtn.classList.add('in-watchlist');
      }
    };
    const escHandler=(e)=>{if(e.key==='Escape'){closeModal(modal);document.removeEventListener('keydown',escHandler);}};
    document.addEventListener('keydown',escHandler);
  }catch(e){console.warn(e);showToast('Could not load details');}
}

function closeModal(modal){
  modal.classList.add('closing');
  setTimeout(()=>modal.remove(),250);
}

function renderGuides(el){
  const wrap=document.createElement('div');wrap.className='guide-wrap';
  if(S.selectedFranchise===null||S.selectedFranchise===undefined){
    wrap.innerHTML=`
      <button class="back-btn" id="g-back">← Back to Oracle</button>
      <div class="eyebrow" style="margin-bottom:20px">WATCH GUIDES</div>
      <h2>Franchise <em>Watch Orders</em></h2>
      <p class="guide-sub">Definitive viewing orders for major film and anime franchises, carefully arranged for the best experience.</p>
      <div class="franchise-list" id="flist"></div>`;
    el.appendChild(wrap);
    wrap.querySelector('#g-back').onclick=()=>go('type');
    const flist=wrap.querySelector('#flist');
    FRANCHISES.forEach((f,i)=>{
      const card=document.createElement('div');card.className='franchise-card';
      card.innerHTML=`<div><div class="franchise-name">${f.icon} ${esc(f.name)}</div><div class="franchise-meta">${esc(f.desc.slice(0,80))}${f.desc.length>80?'...':''}</div><div class="franchise-count">📀 ${f.count}</div><div class="franchise-arr">VIEW ORDER →</div></div>`;
      card.onclick=()=>{S.selectedFranchise=i;go('guides');};
      flist.appendChild(card);
    });
  } else {
    const f=FRANCHISES[S.selectedFranchise];
    wrap.innerHTML=`
      <button class="back-btn" id="g-back">← All Guides</button>
      <div class="eyebrow" style="margin-bottom:20px">WATCH ORDER</div>
      <h2>${f.icon} <em>${esc(f.name)}</em></h2>
      <p class="guide-sub">${esc(f.desc)}</p>
      <div class="franchise-order">
        ${f.order.map(o=>`<div class="order-item"><span class="order-num">${String(o.n).padStart(2,'0')}</span><div><div class="order-title">${esc(o.title)}</div><div class="order-note">${o.year}</div></div></div>`).join('')}
      </div>
      <div style="margin-top:40px;text-align:center"><button class="back-btn" id="g-back-bottom">← Back to Guides</button></div>`;
    el.appendChild(wrap);
    const backBtns=wrap.querySelectorAll('#g-back, #g-back-bottom');
    backBtns.forEach(btn=>btn.onclick=()=>{S.selectedFranchise=null;go('guides');});
  }
}

const toastEl=document.getElementById('toast'),toastMsg=document.getElementById('toast-msg');
let toastTm;
function showToast(msg){toastMsg.textContent=msg;toastEl.classList.add('show');clearTimeout(toastTm);toastTm=setTimeout(()=>toastEl.classList.remove('show'),3200);}
function esc(s){return s?String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'):''}
render();
})();
</script>
</body>
</html>