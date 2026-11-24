// Destaques de competição: foto própria + ordenação manual (Judô Tatsu).
//
// A migration 0039 criou student_highlights apenas com student/reason/month/
// active — a foto própria (file) e o campo de ordenação não chegaram a ser
// criados. Esta migration completa a estrutura:
//  - photo: file (imagem, jpg/png/webp), foto própria do destaque (opcional;
//    quando vazia a home usa a photo do cadastro do aluno);
//  - sort: number inteiro >= 0, menor aparece primeiro;
//  - users.admin_permissions: adiciona a área 'destaques' ao select, para o
//    sistema de permissões por área do painel (AdminRoles).
migrate(
  (app) => {
    const hl = app.findCollectionByNameOrId('student_highlights')
    let changed = false
    if (!hl.fields.getByName('photo')) {
      hl.fields.add(
        new FileField({
          name: 'photo',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        }),
      )
      changed = true
    }
    if (!hl.fields.getByName('sort')) {
      hl.fields.add(new NumberField({ name: 'sort', onlyInt: true, min: 0 }))
      changed = true
    }
    if (changed) app.save(hl)

    const users = app.findCollectionByNameOrId('users')
    const perms = users.fields.getByName('admin_permissions')
    if (perms && perms.values.indexOf('destaques') === -1) {
      perms.values.push('destaques')
      perms.maxSelect = 8
      app.save(users)
    }
  },
  (app) => {
    const hl = app.findCollectionByNameOrId('student_highlights')
    if (hl.fields.getByName('photo')) hl.fields.removeByName('photo')
    if (hl.fields.getByName('sort')) hl.fields.removeByName('sort')
    app.save(hl)

    const users = app.findCollectionByNameOrId('users')
    const perms = users.fields.getByName('admin_permissions')
    if (perms) {
      const i = perms.values.indexOf('destaques')
      if (i !== -1) {
        perms.values.splice(i, 1)
        perms.maxSelect = 7
        app.save(users)
      }
    }
  },
)
