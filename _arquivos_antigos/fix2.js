const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');
const oldChartDiv = `<!-- MAPA DE ESTATISTICAS -->
            <div id="chartdiv" class="mapa-estatisticas"></div>`;
const newChartDiv = `<!-- MAPA DE ESTATISTICAS -->
            <div class="mapa-container-3d">
                <div id="chartdiv" class="mapa-estatisticas"></div>
            </div>`;
html = html.replace(oldChartDiv, newChartDiv);
fs.writeFileSync('index.html', html);
console.log('index.html updated!');

let js = fs.readFileSync('home.js', 'utf8');

const sliderFunctions = `
/* FUNÇÕES DO CARROSSEL DE NOTÍCIAS RESTAURADAS */
let noticiaAtual = 0;

function moverSliderNoticia(direcao) {
    const container = document.getElementById('newsSliderContainer');
    if (!container) return;
    const items = container.children;
    if (items.length === 0) return;
    
    noticiaAtual += direcao;
    if (noticiaAtual < 0) noticiaAtual = items.length - 1;
    if (noticiaAtual >= items.length) noticiaAtual = 0;
    
    atualizarSliderNoticia();
}

function atualizarSliderNoticia() {
    const container = document.getElementById('newsSliderContainer');
    if (!container) return;
    const items = container.children;
    if (items.length === 0) return;

    Array.from(items).forEach((item, i) => {
        let diff = i - noticiaAtual;
        // Ajusta pro cálculo circular em slider
        if (diff < 0) diff += items.length;
        
        item.style.transition = 'all 0.5s ease-in-out';
        item.style.position = 'absolute';
        item.style.top = '0';
        
        if (diff === 0) {
            item.style.transform = 'scale(1) translateX(0) translateZ(0)';
            item.style.opacity = '1';
            item.style.zIndex = '10';
        } else if (diff === 1 || diff === items.length - 1) {
            const side = diff === 1 ? 1 : -1;
            item.style.transform = \`scale(0.85) translateX(\${side * 280}px) translateZ(-100px)\`;
            item.style.opacity = '0.7';
            item.style.zIndex = '5';
        } else {
            const side = diff > 0 ? 1 : -1;
            item.style.transform = \`scale(0.7) translateX(\${side * 400}px) translateZ(-200px)\`;
            item.style.opacity = '0';
            item.style.zIndex = '1';
        }
    });
}
`;

if (!js.includes('function moverSliderNoticia')) {
    const targetIdx = js.indexOf('async function carregarStatsDinamicos()');
    if (targetIdx !== -1) {
        js = js.substring(0, targetIdx) + sliderFunctions + "\n\n" + js.substring(targetIdx);
        fs.writeFileSync('home.js', js);
        console.log('home.js updated!');
    } else {
        console.log('carregarStatsDinamicos not found!');
    }
} else {
    console.log('moverSliderNoticia already exists');
}
