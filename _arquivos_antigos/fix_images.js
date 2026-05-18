const fs = require('fs');

let js = fs.readFileSync('home.js', 'utf8');

// The fallback images are broken external links. Replace them with reliable placeholders so they don't render as white blocks.
const defaultFallback1 = 'https://www.gov.br/saude/pt-br/assuntos/noticias/2022/abril/campanha-de-vacinacao-contra-gripe-e-sarampo-comeca-nesta-segunda-4/vacinacao-gripe-sarampo.jpg/@@images/image.jpeg';
const defaultFallback2 = 'https://img.freepik.com/fotos-gratis/equipe-medica-de-sucesso_329181-4235.jpg';
const defaultFallback3 = 'https://blog.ipog.edu.br/wp-content/uploads/2018/10/m%C3%A9dico-com-tablet.jpg';

js = js.replace(defaultFallback1, 'health_campaign_art_branded.png');
js = js.replace(defaultFallback2, 'health_campaign_art_branded.png');
js = js.replace(defaultFallback3, 'health_campaign_art_branded.png');

fs.writeFileSync('home.js', js);
console.log('home.js fallback images updated to local reliable images!!!');
