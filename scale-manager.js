function adjustScale() {
    const baseWidth = 1600;
    const baseHeight = 900;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;
    
    const scale = Math.min(winWidth / baseWidth, winHeight / baseHeight);
    
    const body = document.body;
    body.style.transform = `translate(-50%, -50%) scale(${scale})`;
    body.style.left = "50%";
    body.style.top = "50%";
    body.style.transformOrigin = "center center";
}

window.addEventListener("resize", adjustScale);
window.addEventListener("DOMContentLoaded", adjustScale);