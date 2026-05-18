const fs = require('fs');

let content = fs.readFileSync('home.js', 'utf8');

const regex = /let autoPlayTimer = null;\s+const startAutoPlay = \(\) => {[\s\S]*?startAutoPlay\(\);\s+};\s+/;

const replacement = `    let autoPlayTimer = null;
    const startAutoPlay = () => {
        if (autoPlayTimer) return;
        autoPlayTimer = setInterval(() => {
            if (slides3D.length === 0 || isDragging) return;
            const step = 360 / slides3D.length;
            carousel3dAngle -= step; 
            spinner.style.transition = 'transform 1.2s cubic-bezier(0.2, 0.8, 0.2, 1)';
            spinner.style.transform = \`translateZ(var(--tz, -425px)) rotateY(\${carousel3dAngle}deg)\`;
            atualizarDots3D();
        }, 3000);
    };

    const stopAutoPlay = () => {
        if (autoPlayTimer) clearInterval(autoPlayTimer);
        autoPlayTimer = null;
    };

    // Função global para girar via dots
    window.girarParaSlide3D = function (index) {
        if (!slides3D || slides3D.length === 0) return;
        stopAutoPlay();
        const step = 360 / slides3D.length;
        // Ajustar o ângulo para ser o mais próximo do atual (evitar giros bruscos)
        const currentRot = Math.round(carousel3dAngle / 360) * 360;
        carousel3dAngle = currentRot - (index * step);
        spinner.style.transition = 'transform 1.2s cubic-bezier(0.2, 0.8, 0.2, 1)';
        spinner.style.transform = \`translateZ(var(--tz, -425px)) rotateY(\${carousel3dAngle}deg)\`;
        atualizarDots3D();
        startAutoPlay();
    };

    // Desktop Mouse Events
    spinner.parentElement.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.pageX;
        spinner.style.transition = 'none';
        spinner.style.cursor = 'grabbing';
        stopAutoPlay();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        currentX = e.pageX;
        const diff = (currentX - startX) * 0.5; // Fator de sensibilidade
        spinner.style.transform = \`translateZ(var(--tz, -425px)) rotateY(\${carousel3dAngle + diff}deg)\`;
    });

    window.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        spinner.style.cursor = 'grab';
        const diff = (e.pageX - startX) * 0.5;
        carousel3dAngle += diff;
        spinner.style.transition = 'transform 1s cubic-bezier(0.2, 0.8, 0.2, 1)';
        if (slides3D.length > 0) {
            const step = 360 / slides3D.length;
            carousel3dAngle = Math.round(carousel3dAngle / step) * step;
            spinner.style.transform = \`translateZ(var(--tz, -425px)) rotateY(\${carousel3dAngle}deg)\`;
            atualizarDots3D();
        }
        startAutoPlay();
    });
`;

if(regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('home.js', content, 'utf8');
    console.log("Fixed! Replaced block exactly.");
} else {
    console.error("Could not find the target block using Regex!");
    console.error(content.substring(content.indexOf('let autoPlayTimer'), content.indexOf('let autoPlayTimer') + 200));
}
