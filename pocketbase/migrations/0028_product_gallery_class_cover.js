/// <reference path="../pb_data/types.d.ts" />
// 0028 — Imagens próprias (identidade do Judô Tatsu):
// - products.gallery: file multi (jpg/png/webp, 5MB cada, máx. 10) — galeria da loja
// - classes.cover: file único (jpg/png/webp, 5MB) — capa do treino/turma
migrate(
  (app) => {
    const products = app.findCollectionByNameOrId('products')
    if (!products.fields.getByName('gallery')) {
      products.fields.add(
        new Field({
          name: 'gallery',
          type: 'file',
          required: false,
          maxSelect: 10,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        }),
      )
      app.save(products)
    }

    const classes = app.findCollectionByNameOrId('classes')
    if (!classes.fields.getByName('cover')) {
      classes.fields.add(
        new Field({
          name: 'cover',
          type: 'file',
          required: false,
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        }),
      )
      app.save(classes)
    }
  },
  (app) => {
    const products = app.findCollectionByNameOrId('products')
    if (products.fields.getByName('gallery')) {
      products.fields.removeByName('gallery')
      app.save(products)
    }

    const classes = app.findCollectionByNameOrId('classes')
    if (classes.fields.getByName('cover')) {
      classes.fields.removeByName('cover')
      app.save(classes)
    }
  },
)
