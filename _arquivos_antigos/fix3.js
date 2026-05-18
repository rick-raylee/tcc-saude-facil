const fs = require('fs');

let js = fs.readFileSync('home.js', 'utf8');

// Remover a declaração let noticiaAtual = 0; lá embaixo
js = js.replace(/let noticiaAtual = 0;/g, '');

// Adicionar let noticiaAtual = 0; lá em cima, logo após let noticias = [];
js = js.replace(/let noticias = \[\];/g, 'let noticias = [];\nlet noticiaAtual = 0;');

fs.writeFileSync('home.js', js);
console.log('home.js variable hoisting fixed!!!');
