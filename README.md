# 🎵 Personal Spotify Dashboard — バシン

Um dashboard musical moderno, focado em alta performance, design minimalista e consumo de dados em tempo real integrando frontend, backend e banco de dados.

🔗 **[Acesse o site ao vivo aqui](https://my-playlist-sigma.vercel.app)**

---

##  <u>Tecnologias Utilizadas</u>

* **Frontend:** Next.js 14+ (App Router), TypeScript, CSS3
* **Backend:** Next.js Route Handlers (Serverless Functions)
* **Integrações:** Spotify Web API, Supabase (PostgreSQL)
* **Hospedagem & CI/CD:** Vercel

---

##  <u>Destaques do Projeto</u>

O maior desafio e diferencial deste projeto foi a construção de um ecossistema musical vivo e reativo que se atualiza sozinho:

* **Ouvindo Agora com Progresso Fluido:** Integração via polling contínuo a cada 8 segundos combinado com um cronômetro local de 1 segundo rodando em paralelo. Isso garante que a barra de progresso se mova de forma contínua e linear, eliminando qualquer delay visual ou engasgo de rede.
* **Sincronização Inteligente de Playlist:** Algoritmo que contorna o limite nativo de 100 músicas do Spotify calculando o deslocamento matemático exato (`offset = total - 5`) com cache desativado (`no-store`). O sistema varre playlists com mais de 500 faixas e captura cirurgicamente apenas as últimas 5 novidades reais, mantendo o bloco atômico atualizado no Supabase.
* **UI/UX Adaptativa & ScrollSpy Nativo:** Fundo ambiente dinâmico com efeito *Ambient Blur* de desfoque profundo (`filter: blur(70px)`) que se adapta à capa do álbum atual. A navegação superior fixa utiliza rastreamento de coordenadas geométricas (`getBoundingClientRect`), tornando o menu imune a rolagens rápidas e totalmente estável em seções curtas, complementado com travas automáticas anti-quebra de layout (`ellipsis`).
