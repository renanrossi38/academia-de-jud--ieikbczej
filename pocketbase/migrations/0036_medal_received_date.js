// Dia de recebimento da medalha dorme dorme (class_medals, migration 0036).
//
// class_medals.received_at: date opcional — o dia em que o aluno recebeu a
// medalha "dorme dorme" no mês. Serve para o painel comparar a constância de
// cada aluno dentro do mês (quantas dorme dormes e em quais dias). Registros
// antigos ficam com o campo vazio (sem data) e seguem sendo listados.
//
// A atribuição da "fica fica" (destaque do mês seguinte) é uma por mês e não
// precisa do dia, mas o campo fica disponível para ambas se um dia for
// informado.
//
// REGRAS: a migration 0035 gravou updateRule = null (remove e recria). Para
// permitir EDITAR o dia de uma dorme dorme já atribuída — sem recriar o
// registro, o que dispararia o índice único class+student+month+kind — a
// updateRule passa a permitir a mesma fórmula de leitura/criação/remoção:
// admin com a área "presencas" (idêntica à 0035).
//
// IDEMPOTENTE: roda vazio em banco recém-criado.
migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('class_medals')

    if (!col.fields.getByName('received_at')) {
      col.fields.add(new DateField({ name: 'received_at', required: false }))
    }

    var AREA_PRESENCAS =
      "@request.auth.id != '' && @request.auth.role = 'admin' && " +
      '(@request.auth.is_owner = true || @request.auth.admin_permissions:length = 0 || ' +
      "@request.auth.admin_permissions ?= 'presencas')"

    col.listRule = '(' + AREA_PRESENCAS + ')'
    col.viewRule = '(' + AREA_PRESENCAS + ')'
    col.createRule = '(' + AREA_PRESENCAS + ')'
    col.updateRule = '(' + AREA_PRESENCAS + ')'
    col.deleteRule = '(' + AREA_PRESENCAS + ')'
    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('class_medals')
    if (col.fields.getByName('received_at')) {
      col.fields.removeByName('received_at')
    }
    col.updateRule = null
    app.save(col)
  },
)
