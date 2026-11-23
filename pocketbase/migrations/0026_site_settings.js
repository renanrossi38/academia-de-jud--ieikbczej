/**
 * 0026 — Collection `site_settings`: conteúdo editável da página inicial.
 *
 * Registro único com o objeto de conteúdo da home em JSON (`data`): textos do
 * hero, seção "Como funciona", endereço, WhatsApp/e-mail e horários de
 * funcionamento (os mesmos textos exibidos no rodapé). O seed traz o conteúdo
 * ATUAL da home, então nada muda visualmente no deploy — a home pública lê
 * este registro e, sem registro, usa os mesmos valores como default
 * (src/services/siteSettings.ts).
 *
 * Regras: leitura PÚBLICA (é conteúdo da página inicial); escrita só admin —
 * mesmo padrão das collections internas do painel (ex.: annual_reports, 0022).
 */
migrate(
  (app) => {
    const collection = new Collection({
      name: 'site_settings',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '@request.auth.role = "admin"',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
      fields: [
        /** Objeto de conteúdo da home (SiteContent, ver src/services/siteSettings.ts). */
        { name: 'data', type: 'json', required: true, maxSize: 200000 },
        /** Nome do admin que salvou (rastro da última edição). */
        { name: 'saved_by', type: 'text', max: 200 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(collection)

    // Seed idempotente: o conteúdo atual da home, para o painel já abrir preenchido.
    const existing = app.findRecordsByFilter('site_settings', '', '', 1, 0)
    if (existing.length === 0) {
      const record = new Record(collection)
      record.set(
        'data',
        JSON.stringify({
          hero_badge: 'Bem-vindo ao Judô Tatsu',
          hero_title: 'Vista-se para o',
          hero_highlight: 'tatame',
          hero_subtitle:
            'Conheça nossas turmas, escolha um horário para começar e adquira seu kimono, faixa e acessórios oficiais com tradição e honra.',
          hero_chip1: 'Aulas para todas as idades',
          hero_chip2: 'Matrícula aberta todo mês',
          hero_side_label: 'Academia de Judô',
          contact_address_line1: 'Rua da Sakura, 123 — Bairro Central',
          contact_address_line2: 'São Paulo - SP — CEP 01234-567',
          contact_whatsapp: '(11) 98765-4321',
          contact_email: 'contato@judotatsu.com',
          hours: [
            { days: 'Segunda a Sexta', time: '07h às 21h30' },
            { days: 'Sábado', time: '09h às 14h (Treinos Livres & Randori)' },
            { days: 'Domingo', time: 'Fechado' },
          ],
          how_tag: 'Simples & Transparente',
          how_title: 'Como funciona a matrícula e as compras no Judô Tatsu',
          how_subtitle:
            'Escolha sua turma, crie sua conta e reserve online. O pagamento é combinado diretamente com a academia.',
          how_steps: [
            {
              title: 'Escolha sua turma',
              description:
                'Veja os horários e a mensalidade na aba de turmas e escolha o nível certo para você.',
            },
            {
              title: 'Monte seu kit de treino',
              description:
                'Kimonos no seu tamanho, faixas graduadas e camisetas oficiais na aba de produtos.',
            },
            {
              title: 'Retire e pague na academia',
              description:
                'O pedido é reservado imediatamente. Pagamento no balcão via Pix, dinheiro ou cartão presencial.',
            },
          ],
          how_guarantee_label: 'Garantia de ajuste:',
          how_guarantee_text:
            'se o kimono ou faixa não vestir confortavelmente no primeiro treino, trocamos o tamanho diretamente no balcão.',
        }),
      )
      app.save(record)
    }
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('site_settings')
    app.delete(collection)
  },
)
