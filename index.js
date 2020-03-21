const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')
const os = require('os')

const filename = path.join(__dirname, 'output.csv');

(async () => {
  const browser = await puppeteer.launch()

  const cookie = {
    name: '.AspNet.ApplicationCookie',
    value: 'value',
    path: '/',
    domain: '.infordat.it'
  }

  const page = await browser.newPage()
  await page.setCookie(cookie)

  await page.goto('https://infordat.it/bancadati/ribassovincente?Categ=OG1&Luoghi=FR%3BLT%3BRI%3BRM%3BVT')

  const data = await page.evaluate(() => {
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

  const tab = await browser.newPage()
  await tab.setCookie(cookie)

  for (let i = 0; i < data.length; i++) {
    await tab.goto('https://infordat.it/bancadati/dettaglioribasso?numgara=' + data[i].numero)
    await tab.screenshot({ path: 'example.png' })

    console.log(i + 1 + ' di ' + data.length)

    try {
      const cig = await tab.$eval('.col-md-3 > .list-group > .list-group-item:nth-child(6)', el => el.textContent.split(':')[1].trim())
      data[i].cig = cig
    } catch (e) {
      console.log('Impossibile reperire il CIG.')
    }
  }

  console.log(data)

  const output = []

  data.forEach((d) => {
    const row = [] // a new array for each row of data
    Object.keys(d).forEach(key => {
      row.push(d[key])
    })

    output.push(row.join()) // by default, join() uses a ','
  })

  fs.writeFileSync(filename, output.join(os.EOL))

  await browser.close()
})()
