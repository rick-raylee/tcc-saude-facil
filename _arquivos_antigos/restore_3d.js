const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// The block to insert:
const carousel3dSection = `
        <!-- NOVO: SEÇÃO DE DESTAQUES EM 3D (NOTÍCIAS) -->
        <section class="highlights-3d-section" style="margin-top: 30px; text-align: center;">
            <div class="carousel-3d-container">
                <div id="carousel3dSpinner" class="carousel-3d-spinner">
                    <!-- Slides dinâmicos injetados via JS -->
                </div>
            </div>
            <!-- PONTOS DE NAVEGAÇÃO (DOTS) E CONTADOR -->
            <div id="carousel3dDots" style="display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 25px;"></div>
        </section>

`;

// Check if it already exists
if (!html.includes('highlights-3d-section')) {
    // Inject right before the noticias-section
    const targetStr = '        <!-- NOTÍCIAS DO GOVERNO -->';
    if (html.includes(targetStr)) {
        html = html.replace(targetStr, carousel3dSection + targetStr);
        fs.writeFileSync('index.html', html);
        console.log('highlights-3d-section injected successfully!');
    } else {
        console.log('Could not find target to inject highlights-3d-section');
    }
} else {
    console.log('highlights-3d-section already exists in index.html');
}
