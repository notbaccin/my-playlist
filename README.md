🎵 Personal Spotify Dashboard — バシン
Dashboard musical responsivo e de alta fidelidade desenvolvido com Next.js (App Router) e TypeScript, integrado de forma síncrona com o Supabase e a API Web do Spotify.

 Engenharia de Funcionamento
🎧 1. Sistema "Ouvindo Agora"
Polling de Estado: Consulta a API local /api/now-playing a cada 8 segundos para obter o status atual do player do Spotify.

Progresso Fluido: Um cronômetro local de segundo em segundo (useEffect) roda em paralelo para atualizar a barra e os marcadores de tempo continuamente, eliminando delays visuais entre as requisições.

Efeito Blur Adaptativo: Captura a imagem da faixa ativa e projeta um plano de fundo ambiente com desfoque de alta intensidade (filter: blur(70px)) e animação suave Ken Burns de aproximação.

💿 2. Filtro Automático de Álbuns Únicos
Extração de Capas: Renderiza os projetos visuais baseando-se no histórico de audição do usuário.

Desduplicação em Memória: Para evitar capas repetidas de um mesmo disco, um gancho de memorização (useMemo) filtra os dados usando a estrutura new Set() sob o padrão chave album::artist, limitando a grade a no máximo 8 álbuns distintos.

⏱️ 3. Paginação Dinâmica de Playlist (Fim do Array)
Contorno do Limite Nativo: Chamadas padrão da API do Spotify leem apenas os primeiros 100 itens. Para ler o final de uma playlist com mais de 500 músicas com cache desativado (cache: "no-store"), a rota faz a busca em dois passos:

Dispara uma chamada rápida com limit=1 para extrair o metadado total da playlist.

Calcula o deslocamento matemático exato (offset = total - limit) para capturar cirurgicamente apenas as 5 últimas faixas reais adicionadas, mapeando o nó moderno da API (item.item).

Sincronização no Banco: O servidor atualiza os registros antigos no Supabase para is_current_member = false e executa um upsert salvando o novo bloco atômico com o status ativo.

📊 4. Ranking de Mais Tocadas
Contador de Persistência: A rota /api/most-played consulta o banco de dados e calcula o volume de execuções agrupando e contando as ocorrências repetidas de cada spotify_id registradas na tabela de logs de auditoria play_log, gerando um ranking decrescente.

📍 5. Navegação por Coordenadas de Tela (ScrollSpy Nativo)
Precisão de Leitura: Substitui o IntersectionObserver tradicional (que pulava seções verticais curtas como a de Álbuns) por um monitoramento manual de rolagem geométrica ativa.

Mecanismo: Avalia o método getBoundingClientRect().top de cada bloco contra uma linha de ativação rígida fixada em 110px (logo abaixo do menu fixo).

Gatilhos de Borda: Força o estado para now-playing no topo absoluto (scrollY < 50) e faz o acendimento automático do último item ao atingir o fim do documento (bottom).

🎨 Ajustes Visuais & UI Polish
Proteção contra Deformação do Grid: Contêineres flexíveis horizontais de rolagem (.row-scroll) possuem cards filhos (.track-card) blindados com propriedades estritas de tamanho máximo (max-width: 156px; overflow: hidden;), impedindo que créditos de "feat." longos estiquem e deformem o layout.

Tratamento de Linha Única (CSS Ellipsis): As classes .track-name e .rank-name utilizam o combo de propriedades white-space: nowrap, overflow: hidden e text-overflow: ellipsis para interceptar e cortar o texto excedente inserindo automaticamente as reticências (...).

Acessibilidade Contextual: A injeção da propriedade html nativa title={t.name} nas tags de texto garante que o usuário consiga ler o nome completo da música que foi cortado simplesmente pousando o ponteiro do mouse por cima do card.
