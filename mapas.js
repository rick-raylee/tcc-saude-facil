let map;

// Dados hardcoded reais de Cascavel PR
const unidadesCascavel = [
    { name: "Hospital Universitário do Oeste do Paraná (HUOP)", address: "Av. Tancredo Neves, 3224 - Santo Antônio", type: "hospital", lat: -24.9818, lng: -53.4862, rating: 4.5 },
    { name: "Hospital São Lucas", address: "R. Eng. Rebouças, 2219 - Centro", type: "hospital", lat: -24.9575, lng: -53.4608, rating: 4.2 },
    { name: "Hospital Policlínica Cascavel", address: "R. Maranhão, 945 - Centro", type: "hospital", lat: -24.9567, lng: -53.4633, rating: 4.1 },
    { name: "Hospital Dr. Lima", address: "R. Paraná, 2311 - Centro", type: "hospital", lat: -24.9538, lng: -53.4560, rating: 4.6 },
    { name: "Hospital de Olhos de Cascavel", address: "R. Minas Gerais, 1932 - Centro", type: "hospital", lat: -24.9580, lng: -53.4630, rating: 4.8 },
    { name: "CEONC - Hospital de Câncer", address: "R. Santa Catarina, 925 - Centro", type: "hospital", lat: -24.9572, lng: -53.4615, rating: 4.9 },
    { name: "UPA Brasília", address: "R. Europa, 2555 - Brasília", type: "hospital", lat: -24.9422, lng: -53.4475, rating: 3.8 },
    { name: "UPA Veneza", address: "Av. Tito Muffato, 2593 - Santa Cruz", type: "hospital", lat: -24.9922, lng: -53.4561, rating: 3.9 },
    { name: "UPA Tancredo Neves", address: "Av. Tancredo Neves, 4220 - Alto Alegre", type: "hospital", lat: -24.9860, lng: -53.4900, rating: 3.7 },
    
    { name: "UBS Floresta", address: "Av. Papagaios, 1850 - Floresta", type: "ubs", lat: -24.9142, lng: -53.4357, rating: 4.0 },
    { name: "UBS Santa Cruz", address: "R. Publio Pimentel, 1515 - Santa Cruz", type: "ubs", lat: -24.9658, lng: -53.4883, rating: 4.3 },
    { name: "UBS Cancelli", address: "R. Presidente Bernardes, 2400 - Cancelli", type: "ubs", lat: -24.9472, lng: -53.4716, rating: 4.1 },
    { name: "UBS Neva", address: "R. Visconde de Guarapuava, 102 - Neva", type: "ubs", lat: -24.9649, lng: -53.4645, rating: 4.2 },
    { name: "UBS Claudete", address: "R. Jorge Lacerda, 2818 - Claudete", type: "ubs", lat: -24.9390, lng: -53.4735, rating: 4.0 },
    { name: "UBS São Cristóvão", address: "R. Domiciliano Theobaldo Bresolin, 333 - São Cristóvão", type: "ubs", lat: -24.9450, lng: -53.4350, rating: 4.4 },
    { name: "UBS Cascavel Velho", address: "R. Presidente Kennedy, 4100 - Cascavel Velho", type: "ubs", lat: -24.9750, lng: -53.4470, rating: 3.9 },
    { name: "UBS Santa Felicidade", address: "R. Cabo José Ermírio de Moraes, 155 - Santa Felicidade", type: "ubs", lat: -24.9850, lng: -53.4600, rating: 4.1 },
    { name: "UBS Parque São Paulo", address: "R. General Osório, 2893 - Parque São Paulo", type: "ubs", lat: -24.9680, lng: -53.4300, rating: 4.2 },
    { name: "UBS XIV de Novembro", address: "R. Souza Naves, 3995 - XIV de Novembro", type: "ubs", lat: -24.9880, lng: -53.4380, rating: 3.8 },
    { name: "USF Aclimação", address: "R. Suécia, 120 - Aclimação", type: "ubs", lat: -24.9500, lng: -53.4200, rating: 4.3 }
];

let allMarkers = [];

document.addEventListener("DOMContentLoaded", () => {
    initLeafletMap();
});

function initLeafletMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement || typeof L === 'undefined') return;

    map = L.map('map', { zoomControl: false }).setView([-24.9555, -53.4552], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    populateMapAndSidebar(unidadesCascavel);
    setupGeolocation();
    setupSearchBar();

    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 150);
}

function getIcon(type) {
    const color = type === 'hospital' ? '#d32f2f' : '#004b82';
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style='background-color:${color}; width:20px; height:20px; border-radius:50%; border:3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.4);'></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
}

function populateMapAndSidebar(placesData) {
    const listContainer = document.getElementById('placesLister');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    
    allMarkers.forEach(m => map.removeLayer(m));
    allMarkers = [];

    if (placesData.length === 0) {
        listContainer.innerHTML = '<p style="color:#666; text-align:center;">Nenhuma unidade encontrada.</p>';
        return;
    }

    const hospitals = placesData.filter(p => p.type === 'hospital');
    const ubss = placesData.filter(p => p.type === 'ubs');

    const renderPlace = (place) => {
        const titleColor = place.type === 'hospital' ? '#d32f2f' : '#004b82';
        const typeLabel = place.type === 'hospital' ? '<i class=\"fi fi-rr-hospital\"></i>  Hospital / UPA' : '<i class=\"fi fi-rr-stethoscope\"></i>  Unidade Básica de Saúde';

        const marker = L.marker([place.lat, place.lng], {icon: getIcon(place.type)}).addTo(map);
        allMarkers.push(marker);

        const contentString = `
            <div style="color: #333; padding: 2px;">
                <div style="font-size: 0.75rem; color: #666; font-weight: bold; margin-bottom: 5px; text-transform: uppercase;">${typeLabel}</div>
                <h3 style="margin:0 0 5px; color: ${titleColor}; font-size: 1.1rem; line-height: 1.2;">${place.name}</h3>
                <p style="margin:0 0 5px; font-size: 0.85rem; color: #555;">${place.address}</p>
                <p style="margin:0; font-size: 0.85rem; color: #f39c12; font-weight:bold;">Avaliação: ⭐ ${place.rating}</p>
            </div>
        `;
        marker.bindPopup(contentString);

        const card = document.createElement('div');
        card.className = `place-card ${place.type}`;
        
        card.innerHTML = `
            <h4 style="color: ${titleColor};">${place.name}</h4>
            <p style="color: #666;">${place.address}</p>
        `;

        card.addEventListener('click', () => {
            map.flyTo([place.lat, place.lng], 16, {duration: 1});
            marker.openPopup();
            if (window.innerWidth <= 768) {
                document.querySelector('.map-container-wrapper').scrollIntoView({ behavior: 'smooth' });
            }
        });

        listContainer.appendChild(card);
    };

    if (hospitals.length > 0) {
        const titleHosp = document.createElement('div');
        titleHosp.innerHTML = `<h3 style="text-align:center; color:#d32f2f; font-size: 1rem; margin: 10px 0 10px 0; border-bottom: 1px solid #eee; padding-bottom: 8px;"><i class="fi fi-rr-hospital"></i>  Hospitais e UPAs</h3>`;
        listContainer.appendChild(titleHosp);
        hospitals.forEach(renderPlace);
    }

    if (ubss.length > 0) {
        const titleUbs = document.createElement('div');
        titleUbs.innerHTML = `<h3 style="text-align:center; color:#004b82; font-size: 1rem; margin: 20px 0 10px 0; border-bottom: 1px solid #eee; padding-bottom: 8px;"><i class="fi fi-rr-stethoscope"></i>  Unidades Básicas de Saúde</h3>`;
        listContainer.appendChild(titleUbs);
        ubss.forEach(renderPlace);
    }
}

function setupSearchBar() {
    const input = document.getElementById("pac-input");
    if (!input) return;
    input.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        const filtered = unidadesCascavel.filter(u => 
            u.name.toLowerCase().includes(val) || 
            u.address.toLowerCase().includes(val)
        );
        populateMapAndSidebar(filtered);
    });
}

function setupGeolocation() {
    const geoBtn = document.getElementById('btnGeolocation');
    if (!geoBtn) return;
    geoBtn.addEventListener('click', () => {
        if (navigator.geolocation) {
            geoBtn.innerHTML = '🕒';
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    
                    L.marker([lat, lng], {
                        icon: L.divIcon({
                            className: 'custom-div-icon',
                            html: `<div style='background-color:#2ecc71; width:24px; height:24px; border-radius:50%; border:3px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.5);'></div>`,
                            iconSize: [24, 24],
                            iconAnchor: [12, 12]
                        })
                    }).addTo(map).bindPopup("<b style='text-align:center;'>📍 Você está aqui!</b>").openPopup();

                    map.flyTo([lat, lng], 15, {duration: 1.5});
                    geoBtn.innerHTML = '📍';
                },
                (error) => {
                    alert('Erro ao pegar localização: ' + error.message);
                    geoBtn.innerHTML = '📍';
                }
            );
        } else {
            alert('Geolocalização não suportada no seu navegador.');
        }
    });
}
