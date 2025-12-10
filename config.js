require("./database/module")

//GLOBAL PAYMENT
global.storename = "𝟑𝒂𝒔𝒉𝒓𝒚🕷️🍷️  "
global.dana = "201503414790"
global.qris = "gada qris gw anjg"


// GLOBAL SETTING
global.owner = "201503414790"
global.namabot = "𝟑𝒂𝒔𝒉𝒓𝒚🕷️  "
global.nomorbot = "201503414790"
global.namaCreator = "𝟑𝒂𝒔𝒉𝒓𝒚🕷️ 🅑🅤🅖 🅑🅞🅣"
global.linkyt = ""
global.autoJoin = false
global.antilink = false
global.versisc = '1.0.0'

// DELAY JPM
global.delayjpm = 5500

// SETTING PANEL
global.apikey = 'PLTC'
global.capikey = 'PLTA'
global.domain = 'https://domain.com'
global.eggsnya = '15'
global.location = '1'



//GLOBAL THUMB

global.codeInvite = ""
global.imageurl = ''
global.isLink = https://whatsapp.com/channel/0029Vavf9XXCMY0KEqmTnC0m
global.packname = "𝟑𝒂𝒔𝒉𝒓𝒚🕷️꧂"
global.author = "☠︎︎︎~𝟑𝒂𝒔𝒉𝒓𝒚🕷️☠︎"
global.jumlah = "5"


let file = require.resolve(__filename)
fs.watchFile(file, () => {
	fs.unwatchFile(file)
	console.log(chalk.redBright(`Update ${__filename}`))
	delete require.cache[file]
	require(file)
})