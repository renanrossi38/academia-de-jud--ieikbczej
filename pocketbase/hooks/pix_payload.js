// Pix "copia e cola" (BR Code EMV) — Judô Tatsu.
//
// ROTA (autenticada):
//   POST /backend/v1/pix-payload
//   body: { kind: 'mensalidade' | 'pedido', id: <recordId> }
//   → { payload, value, txid, qrAvailable: true }
//   → 409 { qrAvailable: false, message } quando a chave Pix não está cadastrada.
//
// O Nubank (e qualquer banco) não tem API de confirmação: o QR é o padrão EMV
// "copia e cola" gerado da CHAVE PIX da academia, com valor e txid. O aluno
// paga no app do banco dele e o ADMIN confirma no painel (confirmação manual).
//
// Payload EMV (BR Code): 00 (payload format) 26 (merchant account info, GUI
// br.gov.bcb.pix + chave) 52 53 54 58 59 (nome) 60 (cidade) 62 (txid) 63 (CRC16).
// Todos os campos TLV com length em 2 dígitos; valores sanitizados (BR Code não
// aceita acentos, máx. 25 chars no nome, 20 no txid).
//
// RESTRIÇÕES DA JSVM: callbacks não enxergam declarações de nível superior —
// toda a lógica fica inline no callback.

routerAdd(
  'POST',
  '/backend/v1/pix-payload',
  (e) => {
    var auth = e.auth
    if (!auth || auth.id === '') {
      throw new UnauthorizedError('Faça login para gerar o Pix.')
    }

    try {
      var body = e.requestInfo().body || {}
      var kind = String(body.kind || '')
      var id = String(body.id || '')

      if (id === '' || (kind !== 'mensalidade' && kind !== 'pedido')) {
        return e.json(400, { message: 'Solicitação inválida.' })
      }

      // ---- Dados Pix da academia (app_settings, gravados pelo painel admin) ----
      function lerSetting(chave) {
        var rows = $app.findRecordsByFilter('app_settings', 'key = {:k}', '', 1, 0, { k: chave })
        return rows.length > 0 ? String(rows[0].getString('value') || '') : ''
      }
      var pixKey = lerSetting('pix_key').trim()
      var receiverName = lerSetting('pix_receiver_name').trim()
      // Cidade do recebedor: opcional; usa o endereço cadastrado nas configurações
      // do site se houver, senão "SAO PAULO".
      var site = {}
      var siteRows = $app.findRecordsByFilter('app_settings', 'key = "site_content"', '', 1, 0)
      if (siteRows.length > 0) {
        try {
          site = JSON.parse(siteRows[0].getString('value') || '{}')
        } catch (errSite) {
          site = {}
        }
      }
      var city = String((site && site.address && site.address.city) || '').trim()
      if (city === '') city = 'SAO PAULO'

      if (pixKey === '' || receiverName === '') {
        return e.json(409, {
          qrAvailable: false,
          message:
            'O pagamento via Pix ainda não está configurado pela academia — combine o pagamento presencialmente.',
        })
      }

      // ---- Valor e txid conforme o que está sendo pago ----
      var value = 0
      var txid = ''
      var description = ''

      if (kind === 'mensalidade') {
        var fee = $app.findRecordById('monthly_fees', id)
        // Só o dono (ou admin) gera o QR desta mensalidade.
        var feeStudent = fee.getString('student')
        var feeOwner = ''
        try {
          var stRec = $app.findRecordById('students', feeStudent)
          feeOwner = stRec.getString('user')
        } catch (errSt) {
          feeOwner = ''
        }
        if (
          feeOwner !== auth.id &&
          auth.getString('role') !== 'admin' &&
          !auth.getBool('is_owner')
        ) {
          throw new UnauthorizedError('Esta mensalidade não é sua.')
        }
        if (fee.getString('status') === 'pago') {
          return e.json(409, {
            qrAvailable: false,
            message: 'Esta mensalidade já está paga — nada a cobrar.',
          })
        }
        value = fee.getFloat('amount')
        txid =
          'MENS' +
          feeStudent.replace(/[^a-zA-Z0-9]/g, '') +
          String(fee.getString('reference_month') || '').replace('-', '')
        description = 'Mensalidade ' + String(fee.getString('reference_month') || '')
      } else {
        var order = $app.findRecordById('orders', id)
        if (
          order.getString('user') !== auth.id &&
          auth.getString('role') !== 'admin' &&
          !auth.getBool('is_owner')
        ) {
          throw new UnauthorizedError('Este pedido não é seu.')
        }
        if (order.getString('status') === 'cancelado') {
          return e.json(409, {
            qrAvailable: false,
            message: 'Este pedido foi cancelado.',
          })
        }
        value = order.getFloat('total')
        txid = 'PED' + order.id.replace(/[^a-zA-Z0-9]/g, '')
        description = 'Pedido #' + order.id.substring(0, 8)
      }

      if (value <= 0) {
        return e.json(409, {
          qrAvailable: false,
          message: 'Valor inválido para o Pix — combine o pagamento presencialmente.',
        })
      }

      // txid do BR Code: alfanumérico, máx. 25 chars (sem espaços).
      if (txid.length > 25) txid = txid.substring(0, 25)
      if (txid === '') txid = 'JUDOTATSU'

      // ---- Montagem do payload EMV ----
      function tlv(tag, val) {
        var v = String(val)
        var len = ('00' + v.length).slice(-2)
        return tag + len + v
      }
      function removeAcentos(str) {
        var mapa = {
          á: 'a',
          à: 'a',
          ã: 'a',
          â: 'a',
          ä: 'a',
          é: 'e',
          è: 'e',
          ê: 'e',
          ë: 'e',
          í: 'i',
          ì: 'i',
          î: 'i',
          ï: 'i',
          ó: 'o',
          ò: 'o',
          õ: 'o',
          ô: 'o',
          ö: 'o',
          ú: 'u',
          ù: 'u',
          û: 'u',
          ü: 'u',
          ç: 'c',
          ñ: 'n',
          Á: 'A',
          À: 'A',
          Ã: 'A',
          Â: 'A',
          Ä: 'A',
          É: 'E',
          È: 'E',
          Ê: 'E',
          Ë: 'E',
          Í: 'I',
          Ì: 'I',
          Î: 'I',
          Ï: 'I',
          Ó: 'O',
          Ò: 'O',
          Õ: 'O',
          Ô: 'O',
          Ö: 'O',
          Ú: 'U',
          Ù: 'U',
          Û: 'U',
          Ü: 'U',
          Ç: 'C',
          Ñ: 'N',
        }
        var out = ''
        for (var i = 0; i < str.length; i++) {
          var ch = str.charAt(i)
          out += mapa[ch] !== undefined ? mapa[ch] : ch
        }
        return out
      }

      // Valor com 2 casas (vírgula do pt-BR vira ponto).
      var valorStr = value.toFixed(2)
      valorStr = valorStr.replace(',', '.')

      // Nome do recebedor: sem acento, máx. 25 chars (exigência do BR Code).
      var nome = removeAcentos(receiverName)
        .replace(/[^a-zA-Z0-9 .\-&/]/g, '')
        .toUpperCase()
      if (nome.length > 25) nome = nome.substring(0, 25)
      nome = nome.trim()
      if (nome === '') nome = 'RECEBEDOR'

      // Cidade: sem acento, máx. 15 chars.
      var cidade = removeAcentos(city)
        .replace(/[^a-zA-Z0-9 .\-]/g, '')
        .toUpperCase()
      if (cidade.length > 15) cidade = cidade.substring(0, 15)
      cidade = cidade.trim()
      if (cidade === '') cidade = 'SAO PAULO'

      var gui = tlv('00', 'br.gov.bcb.pix')
      var chaveField = tlv('01', removeAcentos(pixKey).trim())

      var payload =
        tlv('00', '01') + // Payload Format Indicator
        tlv('26', gui + chaveField) + // Merchant Account Information (Pix)
        tlv('52', '0000') + // Merchant Category Code
        tlv('53', '986') + // Moeda (BRL)
        tlv('54', valorStr) + // Valor
        tlv('58', 'BR') + // País
        tlv('59', nome) + // Nome do recebedor
        tlv('60', cidade) + // Cidade
        tlv('62', tlv('05', txid)) + // Additional Data Field (txid)
        '6304' // tag CRC + length

      // CRC16-CCITT (poly 0x1021, init 0xFFFF) sobre o payload incluindo "6304".
      function crc16(str) {
        var crc = 0xffff
        for (var i = 0; i < str.length; i++) {
          crc ^= str.charCodeAt(i) << 8
          for (var b = 0; b < 8; b++) {
            if ((crc & 0x8000) !== 0) {
              crc = ((crc << 1) ^ 0x1021) & 0xffff
            } else {
              crc = (crc << 1) & 0xffff
            }
          }
        }
        return crc
      }
      var crc = crc16(payload)
      var crcHex = ('000' + crc.toString(16).toUpperCase()).slice(-4)
      payload = payload + crcHex

      return e.json(200, {
        qrAvailable: true,
        payload: payload,
        value: value,
        txid: txid,
        description: description,
        receiverName: receiverName,
      })
    } catch (err) {
      console.log('[pix-payload] ERRO: ' + err)
      return e.json(500, { message: 'Erro ao gerar o Pix: ' + err })
    }
  },
  $apis.requireAuth(),
)
