const dotenv = require('dotenv')
const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')
const os = require('os')
const colors = require('colors')

dotenv.config()

const filename = path.join(__dirname, 'output.csv');

(async () => {
  const browser = await puppeteer.launch()

  const cookie = {
    name: '.AspNet.ApplicationCookie',
    value: process.env.INFORDAT_COOKIE,
    path: '/',
    domain: '.infordat.it'
  }

  const infordat = await browser.newPage()
  await infordat.setCookie(cookie)

  await infordat.goto('https://infordat.it/bancadati/ribassovincente?Categ=OG1&Luoghi=FR%3BLT%3BRI%3BRM%3BVT')

  const data = await infordat.evaluate(() => {
    const rows = document.querySelectorAll('#risultati_ribasso > tr')
    const data = []

    for (let i = 0; i < rows.length; i++) {
      data[i] = {}
      data[i].titolo = rows[i].querySelector('td:nth-child(2)').textContent
      data[i].numero = rows[i].querySelector('td:nth-child(3) > span').dataset.path.split('=')[1]
      data[i].data = rows[i].querySelector('td:nth-child(4)').textContent.split('\n')[0]
      data[i].ribasso = rows[i].querySelector('td:nth-child(5)').textContent.split(',').join('.')
      data[i].importo = rows[i].querySelector('td:nth-child(6)').textContent.split('.').join('').split(',').join('.')
      data[i].procedura = rows[i].querySelector('td:nth-child(7)').textContent
      data[i].criterio = rows[i].querySelector('td:nth-child(8)').textContent
      data[i].ditte = rows[i].querySelector('td:nth-child(9)').textContent
      data[i].provincia = rows[i].querySelector('td:nth-child(11)').textContent.split('\n')[1].trim()
    }

    return data
  })

  const dettaglio = await browser.newPage()
  const anac = await browser.newPage()
  await dettaglio.setCookie(cookie)

  for (let i = 0; i < data.length; i++) {
    await dettaglio.goto('https://infordat.it/bancadati/dettaglioribasso?numgara=' + data[i].numero)
    await dettaglio.screenshot({ path: 'infordat.png' })

    console.log('\n' + ++i + ' di ' + data.length)

    try {
      const cig = await dettaglio.$eval('.col-md-3 > .list-group > .list-group-item:last-child', el => el.textContent.split(':')[1].trim())
      data[i].cig = cig
      console.log(colors.green('CIG: ' + data[i].cig))
      console.log(colors.yellow(data[i].titolo))
    } catch (e) {
      console.log(colors.red('Impossibile reperire il CIG.'))
    }

    // await infordat.close()

    try {
      if (!data[i].cig) throw new Error()
      await anac.goto(`http://portaletrasparenza.anticorruzione.it/Microstrategy/asp/Main.aspx?evt=2048001&src=Main.aspx.2048001&visMode=0&hiddenSections=header,footer,path,dockTop&documentID=0E392EF94E86CCDD246176A3580200AB&valuePromptAnswers=${data[i].cig}&currentViewMedia=2&Main.aspx=-10*.119*.128*.95.SISk*_Extranet.0_&shared=*-1.*-1.0.0.0&ftb=0.422541B24E28B69DC5DF858B20E67091.*0.8.0.0-8.18_268453447.*-1.1.*0&fb=0.422541B24E28B69DC5DF858B20E67091.Extranet.8.0.0-8.768.769.774.770.773.772.775.55.256.10.257.776.777_268453447.*-1.1.*0&uid=web&pwd=no`)
      await anac.screenshot({ path: 'anac.png' })

      data[i].nome_ente = await anac.$eval('#grid_K205_0_2_9_1 ~ td', el => el.textContent.trim())
      data[i].cf_ente = await anac.$eval('#grid_K205_0_2_10_1 ~ td', el => el.textContent.trim())
    } catch (e) {
      console.log(colors.red('Impossibile reperire le informazione dalla base dati dell\'ANAC.'))
    }
  }

  // await dettaglio.close()
  // await anac.close()

  console.log(data)

  const output = []

  data.forEach((d) => {
    const row = []
    Object.keys(d).forEach(key => {
      row.push(d[key])
    })

    output.push(row.join())
  })

  fs.writeFileSync(filename, output.join(os.EOL))

  await browser.close()
})()
