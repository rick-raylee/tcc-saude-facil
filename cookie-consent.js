(function() {
    // Check if the user has already answered the cookie consent
    const consent = localStorage.getItem('cookieConsent');
    if (consent) {
        return; // Already consented/rejected
    }

    // Create style block
    const style = document.createElement('style');
    style.innerHTML = `
        #cookie-consent-banner {
            position: fixed;
            bottom: 20px;
            left: 20px;
            right: 20px;
            z-index: 999999;
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(0, 0, 0, 0.1);
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
            padding: 20px 30px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            color: #333;
            font-family: 'Inter', sans-serif;
            max-width: 800px;
            margin: 0 auto;
            transform: translateY(100%);
            opacity: 0;
            animation: slideUpCookie 0.5s forwards ease-out 1s;
        }

        @keyframes slideUpCookie {
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }

        #cookie-consent-banner .cc-header {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        #cookie-consent-banner .cc-header h3 {
            margin: 0;
            font-size: 1.2rem;
            color: #004b82; /* health-blue */
        }

        #cookie-consent-banner .cc-body p {
            margin: 0;
            font-size: 0.95rem;
            line-height: 1.5;
            color: #555;
        }

        #cookie-consent-banner .cc-buttons {
            display: flex;
            gap: 15px;
            justify-content: flex-end;
            margin-top: 10px;
            flex-wrap: wrap;
        }

        .cc-btn {
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 0.9rem;
            border: none;
        }

        .cc-btn-necessary {
            background: transparent;
            color: #555;
            border: 1px solid #ccc;
        }

        .cc-btn-necessary:hover {
            background: rgba(0,0,0,0.05);
            border-color: #999;
            color: #333;
        }

        .cc-btn-all {
            background: #004b82; /* health-blue */
            color: #fff;
            box-shadow: 0 4px 10px rgba(0, 75, 130, 0.3);
        }

        .cc-btn-all:hover {
            background: #003660;
            box-shadow: 0 4px 15px rgba(0, 75, 130, 0.5);
            transform: translateY(-2px);
        }

        .cc-link {
            color: #004b82;
            text-decoration: underline;
            font-size: 0.9rem;
            font-weight: 600;
        }

        @media (max-width: 768px) {
            #cookie-consent-banner {
                bottom: 10px;
                left: 10px;
                right: 10px;
                padding: 15px;
            }
            #cookie-consent-banner .cc-buttons {
                flex-direction: column;
            }
            .cc-btn {
                width: 100%;
                text-align: center;
            }
        }
    `;
    document.head.appendChild(style);

    // Create banner
    const banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.innerHTML = `
        <div class="cc-header">
            <span style="font-size: 1.5rem;">🍪</span>
            <h3>Aviso de Privacidade e Cookies</h3>
        </div>
        <div class="cc-body">
            <p>
                O Portal Saúde Fácil utiliza cookies para melhorar sua experiência de navegação, oferecer recursos personalizados e analisar nosso tráfego de forma anônima. 
                Você pode escolher aceitar todos os cookies ou gerenciar suas preferências aceitando apenas os essenciais para o funcionamento do site, de acordo com as normas da LGPD.
                <br><a href="privacidade.html" class="cc-link">Leia nossa Política de Privacidade</a>.
            </p>
        </div>
        <div class="cc-buttons">
            <button class="cc-btn cc-btn-necessary" id="cc-btn-necessary">Apenas os Necessários</button>
            <button class="cc-btn cc-btn-all" id="cc-btn-all">Aceitar Todos</button>
        </div>
    `;
    document.body.appendChild(banner);

    // Event listeners
    document.getElementById('cc-btn-necessary').addEventListener('click', function() {
        localStorage.setItem('cookieConsent', 'necessary');
        closeBanner();
    });

    document.getElementById('cc-btn-all').addEventListener('click', function() {
        localStorage.setItem('cookieConsent', 'all');
        closeBanner();
    });

    function closeBanner() {
        banner.style.animation = 'none'; // reset previous animation
        banner.style.transition = 'transform 0.4s ease-in, opacity 0.4s ease-in';
        banner.style.transform = 'translateY(100%)';
        banner.style.opacity = '0';
        setTimeout(() => {
            if (banner.parentNode) {
                banner.parentNode.removeChild(banner);
            }
        }, 400);
    }
})();
