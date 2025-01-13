/**
 * Pokemon Showdown Dex Data
 *
 * A collection of data and definitions for src/battle-dex.ts.
 *
 * Larger data has their own files in data/, so this is just for small
 * miscellaneous data that doesn't need its own file.
 *
 * Licensing note: PS's client has complicated licensing:
 * - The client as a whole is AGPLv3
 * - The battle replay/animation engine (battle-*.ts) by itself is MIT
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license MIT
 */

/**
 * String that contains only lowercase alphanumeric characters.
 */
type ID = string & {__isID: true};

interface Nature {
	plus?: StatNameExceptHP;
	minus?: StatNameExceptHP;
}

const BattleNatures: {[k in NatureName]: Nature} = {
	Adamant: {
		plus: 'atk',
		minus: 'spa',
	},
	Bashful: {},
	Bold: {
		plus: 'def',
		minus: 'atk',
	},
	Brave: {
		plus: 'atk',
		minus: 'spe',
	},
	Calm: {
		plus: 'spd',
		minus: 'atk',
	},
	Careful: {
		plus: 'spd',
		minus: 'spa',
	},
	Docile: {},
	Gentle: {
		plus: 'spd',
		minus: 'def',
	},
	Hardy: {},
	Hasty: {
		plus: 'spe',
		minus: 'def',
	},
	Impish: {
		plus: 'def',
		minus: 'spa',
	},
	Jolly: {
		plus: 'spe',
		minus: 'spa',
	},
	Lax: {
		plus: 'def',
		minus: 'spd',
	},
	Lonely: {
		plus: 'atk',
		minus: 'def',
	},
	Mild: {
		plus: 'spa',
		minus: 'def',
	},
	Modest: {
		plus: 'spa',
		minus: 'atk',
	},
	Naive: {
		plus: 'spe',
		minus: 'spd',
	},
	Naughty: {
		plus: 'atk',
		minus: 'spd',
	},
	Quiet: {
		plus: 'spa',
		minus: 'spe',
	},
	Quirky: {},
	Rash: {
		plus: 'spa',
		minus: 'spd',
	},
	Relaxed: {
		plus: 'def',
		minus: 'spe',
	},
	Sassy: {
		plus: 'spd',
		minus: 'spe',
	},
	Serious: {},
	Timid: {
		plus: 'spe',
		minus: 'atk',
	},
};
const BattleStatIDs: {[k: string]: StatName | undefined} = {
	HP: 'hp',
	hp: 'hp',
	Atk: 'atk',
	atk: 'atk',
	Def: 'def',
	def: 'def',
	SpA: 'spa',
	SAtk: 'spa',
	SpAtk: 'spa',
	spa: 'spa',
	spc: 'spa',
	Spc: 'spa',
	SpD: 'spd',
	SDef: 'spd',
	SpDef: 'spd',
	spd: 'spd',
	Spe: 'spe',
	Spd: 'spe',
	spe: 'spe',
};
/** Stat short names */
const BattleStatNames = {
	hp: 'HP',
	atk: 'Atk',
	def: 'Def',
	spa: 'SpA',
	spd: 'SpD',
	spe: 'Spe',
} as const;

const BattleBaseSpeciesChart = [
	"unown", "burmy", "shellos", "gastrodon", "deerling", "sawsbuck", "vivillon", "flabebe", "floette", "florges", "furfrou", "minior", "alcremie", "tatsugiri", "pokestarufo", "pokestarbrycenman", "pokestarmt", "pokestarmt2", "pokestartransport", "pokestargiant", "pokestarhumanoid", "pokestarmonster", "pokestarf00", "pokestarf002", "pokestarspirit", "pokestarblackdoor", "pokestarwhitedoor", "pokestarblackbelt",
] as ID[];

const BattlePokemonIconIndexes: {[id: string]: number} = {
	// alt forms
	egg: 1032 + 1,
	pikachubelle: 1032 + 2,
	pikachulibre: 1032 + 3,
	pikachuphd: 1032 + 4,
	pikachupopstar: 1032 + 5,
	pikachurockstar: 1032 + 6,
	pikachucosplay: 1032 + 7,
	unownexclamation: 1032 + 8,
	unownquestion: 1032 + 9,
	unownb: 1032 + 10,
	unownc: 1032 + 11,
	unownd: 1032 + 12,
	unowne: 1032 + 13,
	unownf: 1032 + 14,
	unowng: 1032 + 15,
	unownh: 1032 + 16,
	unowni: 1032 + 17,
	unownj: 1032 + 18,
	unownk: 1032 + 19,
	unownl: 1032 + 20,
	unownm: 1032 + 21,
	unownn: 1032 + 22,
	unowno: 1032 + 23,
	unownp: 1032 + 24,
	unownq: 1032 + 25,
	unownr: 1032 + 26,
	unowns: 1032 + 27,
	unownt: 1032 + 28,
	unownu: 1032 + 29,
	unownv: 1032 + 30,
	unownw: 1032 + 31,
	unownx: 1032 + 32,
	unowny: 1032 + 33,
	unownz: 1032 + 34,
	castformrainy: 1032 + 35,
	castformsnowy: 1032 + 36,
	castformsunny: 1032 + 37,
	deoxysattack: 1032 + 38,
	deoxysdefense: 1032 + 39,
	deoxysspeed: 1032 + 40,
	burmysandy: 1032 + 41,
	burmytrash: 1032 + 42,
	wormadamsandy: 1032 + 43,
	wormadamtrash: 1032 + 44,
	cherrimsunshine: 1032 + 45,
	shelloseast: 1032 + 46,
	gastrodoneast: 1032 + 47,
	rotomfan: 1032 + 48,
	rotomfrost: 1032 + 49,
	rotomheat: 1032 + 50,
	rotommow: 1032 + 51,
	rotomwash: 1032 + 52,
	giratinaorigin: 1032 + 53,
	shayminsky: 1032 + 54,
	unfezantf: 1032 + 55,
	basculinbluestriped: 1032 + 56,
	darmanitanzen: 1032 + 57,
	deerlingautumn: 1032 + 58,
	deerlingsummer: 1032 + 59,
	deerlingwinter: 1032 + 60,
	sawsbuckautumn: 1032 + 61,
	sawsbucksummer: 1032 + 62,
	sawsbuckwinter: 1032 + 63,
	frillishf: 1032 + 64,
	jellicentf: 1032 + 65,
	tornadustherian: 1032 + 66,
	thundurustherian: 1032 + 67,
	landorustherian: 1032 + 68,
	kyuremblack: 1032 + 69,
	kyuremwhite: 1032 + 70,
	keldeoresolute: 1032 + 71,
	meloettapirouette: 1032 + 72,
	vivillonarchipelago: 1032 + 73,
	vivilloncontinental: 1032 + 74,
	vivillonelegant: 1032 + 75,
	vivillonfancy: 1032 + 76,
	vivillongarden: 1032 + 77,
	vivillonhighplains: 1032 + 78,
	vivillonicysnow: 1032 + 79,
	vivillonjungle: 1032 + 80,
	vivillonmarine: 1032 + 81,
	vivillonmodern: 1032 + 82,
	vivillonmonsoon: 1032 + 83,
	vivillonocean: 1032 + 84,
	vivillonpokeball: 1032 + 85,
	vivillonpolar: 1032 + 86,
	vivillonriver: 1032 + 87,
	vivillonsandstorm: 1032 + 88,
	vivillonsavanna: 1032 + 89,
	vivillonsun: 1032 + 90,
	vivillontundra: 1032 + 91,
	pyroarf: 1032 + 92,
	flabebeblue: 1032 + 93,
	flabebeorange: 1032 + 94,
	flabebewhite: 1032 + 95,
	flabebeyellow: 1032 + 96,
	floetteblue: 1032 + 97,
	floetteeternal: 1032 + 98,
	floetteorange: 1032 + 99,
	floettewhite: 1032 + 100,
	floetteyellow: 1032 + 101,
	florgesblue: 1032 + 102,
	florgesorange: 1032 + 103,
	florgeswhite: 1032 + 104,
	florgesyellow: 1032 + 105,
	furfroudandy: 1032 + 106,
	furfroudebutante: 1032 + 107,
	furfroudiamond: 1032 + 108,
	furfrouheart: 1032 + 109,
	furfroukabuki: 1032 + 110,
	furfroulareine: 1032 + 111,
	furfroumatron: 1032 + 112,
	furfroupharaoh: 1032 + 113,
	furfroustar: 1032 + 114,
	meowsticf: 1032 + 115,
	aegislashblade: 1032 + 116,
	xerneasneutral: 1032 + 117,
	hoopaunbound: 1032 + 118,
	rattataalola: 1032 + 119,
	raticatealola: 1032 + 120,
	raichualola: 1032 + 121,
	sandshrewalola: 1032 + 122,
	sandslashalola: 1032 + 123,
	vulpixalola: 1032 + 124,
	ninetalesalola: 1032 + 125,
	diglettalola: 1032 + 126,
	dugtrioalola: 1032 + 127,
	meowthalola: 1032 + 128,
	persianalola: 1032 + 129,
	geodudealola: 1032 + 130,
	graveleralola: 1032 + 131,
	golemalola: 1032 + 132,
	grimeralola: 1032 + 133,
	mukalola: 1032 + 134,
	exeggutoralola: 1032 + 135,
	marowakalola: 1032 + 136,
	greninjaash: 1032 + 137,
	zygarde10: 1032 + 138,
	zygardecomplete: 1032 + 139,
	oricoriopompom: 1032 + 140,
	oricoriopau: 1032 + 141,
	oricoriosensu: 1032 + 142,
	lycanrocmidnight: 1032 + 143,
	wishiwashischool: 1032 + 144,
	miniormeteor: 1032 + 145,
	miniororange: 1032 + 146,
	minioryellow: 1032 + 147,
	miniorgreen: 1032 + 148,
	miniorblue: 1032 + 149,
	miniorindigo: 1032 + 150,
	miniorviolet: 1032 + 151,
	magearnaoriginal: 1032 + 152,
	pikachuoriginal: 1032 + 153,
	pikachuhoenn: 1032 + 154,
	pikachusinnoh: 1032 + 155,
	pikachuunova: 1032 + 156,
	pikachukalos: 1032 + 157,
	pikachualola: 1032 + 158,
	pikachupartner: 1032 + 159,
	lycanrocdusk: 1032 + 160,
	necrozmaduskmane: 1032 + 161,
	necrozmadawnwings: 1032 + 162,
	necrozmaultra: 1032 + 163,
	pikachustarter: 1032 + 164,
	eeveestarter: 1032 + 165,
	meowthgalar: 1032 + 166,
	ponytagalar: 1032 + 167,
	rapidashgalar: 1032 + 168,
	farfetchdgalar: 1032 + 169,
	weezinggalar: 1032 + 170,
	mrmimegalar: 1032 + 171,
	corsolagalar: 1032 + 172,
	zigzagoongalar: 1032 + 173,
	linoonegalar: 1032 + 174,
	darumakagalar: 1032 + 175,
	darmanitangalar: 1032 + 176,
	darmanitangalarzen: 1032 + 177,
	yamaskgalar: 1032 + 178,
	stunfiskgalar: 1032 + 179,
	cramorantgulping: 1032 + 180,
	cramorantgorging: 1032 + 181,
	toxtricitylowkey: 1032 + 182,
	alcremierubycream: 1032 + 183,
	alcremiematchacream: 1032 + 184,
	alcremiemintcream: 1032 + 185,
	alcremielemoncream: 1032 + 186,
	alcremiesaltedcream: 1032 + 187,
	alcremierubyswirl: 1032 + 188,
	alcremiecaramelswirl: 1032 + 189,
	alcremierainbowswirl: 1032 + 190,
	eiscuenoice: 1032 + 191,
	indeedeef: 1032 + 192,
	morpekohangry: 1032 + 193,
	zaciancrowned: 1032 + 194,
	zamazentacrowned: 1032 + 195,
	slowpokegalar: 1032 + 196,
	slowbrogalar: 1032 + 197,
	zarudedada: 1032 + 198,
	pikachuworld: 1032 + 199,
	articunogalar: 1032 + 200,
	zapdosgalar: 1032 + 201,
	moltresgalar: 1032 + 202,
	slowkinggalar: 1032 + 203,
	calyrexice: 1032 + 204,
	calyrexshadow: 1032 + 205,
	growlithehisui: 1032 + 206,
	arcaninehisui: 1032 + 207,
	voltorbhisui: 1032 + 208,
	electrodehisui: 1032 + 209,
	typhlosionhisui: 1032 + 210,
	qwilfishhisui: 1032 + 211,
	sneaselhisui: 1032 + 212,
	samurotthisui: 1032 + 213,
	lilliganthisui: 1032 + 214,
	zoruahisui: 1032 + 215,
	zoroarkhisui: 1032 + 216,
	braviaryhisui: 1032 + 217,
	sliggoohisui: 1032 + 218,
	goodrahisui: 1032 + 219,
	avalugghisui: 1032 + 220,
	decidueyehisui: 1032 + 221,
	basculegionf: 1032 + 222,
	enamorustherian: 1032 + 223,
	taurospaldeacombat: 1032 + 224,
	taurospaldeablaze: 1032 + 225,
	taurospaldeaaqua: 1032 + 226,
	wooperpaldea: 1032 + 227,
	oinkolognef: 1032 + 228,
	palafinhero: 1032 + 229,
	mausholdfour: 1032 + 230,
	tatsugiridroopy: 1032 + 231,
	tatsugiristretchy: 1032 + 232,
	squawkabillyblue: 1032 + 233,
	squawkabillyyellow: 1032 + 234,
	squawkabillywhite: 1032 + 235,
	gimmighoulroaming: 1032 + 236,
	dialgaorigin: 1032 + 237,
	palkiaorigin: 1032 + 238,
	basculinwhitestriped: 1032 + 239,
	ursalunabloodmoon: 1032 + 240,
	ogerponwellspring: 1032 + 241,
	ogerponhearthflame: 1032 + 242,
	ogerponcornerstone: 1032 + 243,
	terapagosterastal: 1032 + 244,
	terapagosstellar: 1032 + 245,

	arceusbug: 1032 + 246,
	arceusdark: 1032 + 247,
	arceusdragon: 1032 + 248,
	arceuselectric: 1032 + 249,
	arceusfairy: 1032 + 250,
	arceusfighting: 1032 + 251,
	arceusfire: 1032 + 252,
	arceusflying: 1032 + 253,
	arceusghost: 1032 + 254,
	arceusgrass: 1032 + 255,
	arceusground: 1032 + 256,
	arceusice: 1032 + 257,
	arceuspoison: 1032 + 258,
	arceuspsychic: 1032 + 259,
	arceusrock: 1032 + 260,
	arceussteel: 1032 + 261,
	arceuswater: 1032 + 262,

	genesectdouse: 1032 + 263,
	genesectshock: 1032 + 264,
	genesectburn: 1032 + 265,
	genesectchill: 1032 + 266,

	silvallybug: 1032 + 267,
	silvallydark: 1032 + 268,
	silvallydragon: 1032 + 269,
	silvallyelectric: 1032 + 270,
	silvallyfairy: 1032 + 271,
	silvallyfighting: 1032 + 272,
	silvallyfire: 1032 + 273,
	silvallyflying: 1032 + 274,
	silvallyghost: 1032 + 275,
	silvallygrass: 1032 + 276,
	silvallyground: 1032 + 277,
	silvallyice: 1032 + 278,
	silvallypoison: 1032 + 279,
	silvallypsychic: 1032 + 280,
	silvallyrock: 1032 + 281,
	silvallysteel: 1032 + 282,
	silvallywater: 1032 + 283,

	// alt forms with duplicate icons
	greninjabond: 658,
	gumshoostotem: 735,
	raticatealolatotem: 1032 + 120,
	marowakalolatotem: 1032 + 136,
	araquanidtotem: 752,
	lurantistotem: 754,
	salazzletotem: 758,
	vikavolttotem: 738,
	togedemarutotem: 777,
	mimikyutotem: 778,
	mimikyubustedtotem: 778,
	ribombeetotem: 743,
	kommoototem: 784,
	sinisteaantique: 854,
	polteageistantique: 855,
	poltchageistartisan: 1012,
	sinistchamasterpiece: 1013,
	ogerpontealtera: 1017,
	ogerponwellspringtera: 1032 + 241,
	ogerponhearthflametera: 1032 + 242,
	ogerponcornerstonetera: 1032 + 243,
	toxtricitylowkeygmax: 1320 + 69,

	// Mega/G-Max
	venusaurmega: 1320 + 0,
	charizardmegax: 1320 + 1,
	charizardmegay: 1320 + 2,
	blastoisemega: 1320 + 3,
	beedrillmega: 1320 + 4,
	pidgeotmega: 1320 + 5,
	alakazammega: 1320 + 6,
	slowbromega: 1320 + 7,
	gengarmega: 1320 + 8,
	kangaskhanmega: 1320 + 9,
	pinsirmega: 1320 + 10,
	gyaradosmega: 1320 + 11,
	aerodactylmega: 1320 + 12,
	mewtwomegax: 1320 + 13,
	mewtwomegay: 1320 + 14,
	ampharosmega: 1320 + 15,
	steelixmega: 1320 + 16,
	scizormega: 1320 + 17,
	heracrossmega: 1320 + 18,
	houndoommega: 1320 + 19,
	tyranitarmega: 1320 + 20,
	sceptilemega: 1320 + 21,
	blazikenmega: 1320 + 22,
	swampertmega: 1320 + 23,
	gardevoirmega: 1320 + 24,
	sableyemega: 1320 + 25,
	mawilemega: 1320 + 26,
	aggronmega: 1320 + 27,
	medichammega: 1320 + 28,
	manectricmega: 1320 + 29,
	sharpedomega: 1320 + 30,
	cameruptmega: 1320 + 31,
	altariamega: 1320 + 32,
	banettemega: 1320 + 33,
	absolmega: 1320 + 34,
	glaliemega: 1320 + 35,
	salamencemega: 1320 + 36,
	metagrossmega: 1320 + 37,
	latiasmega: 1320 + 38,
	latiosmega: 1320 + 39,
	kyogreprimal: 1320 + 40,
	groudonprimal: 1320 + 41,
	rayquazamega: 1320 + 42,
	lopunnymega: 1320 + 43,
	garchompmega: 1320 + 44,
	lucariomega: 1320 + 45,
	abomasnowmega: 1320 + 46,
	gallademega: 1320 + 47,
	audinomega: 1320 + 48,
	dianciemega: 1320 + 49,
	charizardgmax: 1320 + 50,
	butterfreegmax: 1320 + 51,
	pikachugmax: 1320 + 52,
	meowthgmax: 1320 + 53,
	machampgmax: 1320 + 54,
	gengargmax: 1320 + 55,
	kinglergmax: 1320 + 56,
	laprasgmax: 1320 + 57,
	eeveegmax: 1320 + 58,
	snorlaxgmax: 1320 + 59,
	garbodorgmax: 1320 + 60,
	melmetalgmax: 1320 + 61,
	corviknightgmax: 1320 + 62,
	orbeetlegmax: 1320 + 63,
	drednawgmax: 1320 + 64,
	coalossalgmax: 1320 + 65,
	flapplegmax: 1320 + 66,
	appletungmax: 1320 + 67,
	sandacondagmax: 1320 + 68,
	toxtricitygmax: 1320 + 69,
	centiskorchgmax: 1320 + 70,
	hatterenegmax: 1320 + 71,
	grimmsnarlgmax: 1320 + 72,
	alcremiegmax: 1320 + 73,
	copperajahgmax: 1320 + 74,
	duraludongmax: 1320 + 75,
	eternatuseternamax: 1320 + 76,
	venusaurgmax: 1320 + 77,
	blastoisegmax: 1320 + 78,
	rillaboomgmax: 1320 + 79,
	cinderacegmax: 1320 + 80,
	inteleongmax: 1320 + 81,
	urshifugmax: 1320 + 82,
	urshifurapidstrikegmax: 1320 + 83,

	// CAP
	syclant: 1512 + 0,
	revenankh: 1512 + 1,
	pyroak: 1512 + 2,
	fidgit: 1512 + 3,
	stratagem: 1512 + 4,
	arghonaut: 1512 + 5,
	kitsunoh: 1512 + 6,
	cyclohm: 1512 + 7,
	colossoil: 1512 + 8,
	krilowatt: 1512 + 9,
	voodoom: 1512 + 10,
	tomohawk: 1512 + 11,
	necturna: 1512 + 12,
	mollux: 1512 + 13,
	aurumoth: 1512 + 14,
	malaconda: 1512 + 15,
	cawmodore: 1512 + 16,
	volkraken: 1512 + 17,
	plasmanta: 1512 + 18,
	naviathan: 1512 + 19,
	crucibelle: 1512 + 20,
	crucibellemega: 1512 + 21,
	kerfluffle: 1512 + 22,
	pajantom: 1512 + 23,
	jumbao: 1512 + 24,
	caribolt: 1512 + 25,
	smokomodo: 1512 + 26,
	snaelstrom: 1512 + 27,
	equilibra: 1512 + 28,
	astrolotl: 1512 + 29,
	miasmaw: 1512 + 30,
	chromera: 1512 + 31,
	venomicon: 1512 + 32,
	venomiconepilogue: 1512 + 33,
	saharaja: 1512 + 34,
	hemogoblin: 1512 + 35,
	syclar: 1512 + 36,
	embirch: 1512 + 37,
	flarelm: 1512 + 38,
	breezi: 1512 + 39,
	scratchet: 1512 + 40,
	necturine: 1512 + 41,
	cupra: 1512 + 42,
	argalis: 1512 + 43,
	brattler: 1512 + 44,
	cawdet: 1512 + 45,
	volkritter: 1512 + 46,
	snugglow: 1512 + 47,
	floatoy: 1512 + 48,
	caimanoe: 1512 + 49,
	pluffle: 1512 + 50,
	rebble: 1512 + 51,
	tactite: 1512 + 52,
	privatyke: 1512 + 53,
	nohface: 1512 + 54,
	monohm: 1512 + 55,
	duohm: 1512 + 56,
	protowatt: 1512 + 57,
	voodoll: 1512 + 58,
	mumbao: 1512 + 59,
	fawnifer: 1512 + 60,
	electrelk: 1512 + 61,
	smogecko: 1512 + 62,
	smoguana: 1512 + 63,
	swirlpool: 1512 + 64,
	coribalis: 1512 + 65,
	justyke: 1512 + 66,
	solotl: 1512 + 67,
	miasmite: 1512 + 68,
	dorsoil: 1512 + 69,
	saharascal: 1512 + 70,
	ababo: 1512 + 71,
	scattervein: 1512 + 72,
	cresceidon: 1512 + 73,
	chuggalong: 1512 + 74,
	shox: 1512 + 75,
};

const BattlePokemonIconIndexesLeft: {[id: string]: number} = {
	pikachubelle: 1404 + 0,
	pikachupopstar: 1404 + 1,
	clefairy: 1404 + 2,
	clefable: 1404 + 3,
	jigglypuff: 1404 + 4,
	wigglytuff: 1404 + 5,
	dugtrioalola: 1404 + 6,
	poliwhirl: 1404 + 7,
	poliwrath: 1404 + 8,
	mukalola: 1404 + 9,
	kingler: 1404 + 10,
	croconaw: 1404 + 11,
	cleffa: 1404 + 12,
	igglybuff: 1404 + 13,
	politoed: 1404 + 14,
	unownb: 1404 + 15,
	unownc: 1404 + 16,
	unownd: 1404 + 17,
	unowne: 1404 + 18,
	unownf: 1404 + 19,
	unowng: 1404 + 20,
	unownh: 1404 + 21,
	unownj: 1404 + 22,
	unownk: 1404 + 23,
	unownl: 1404 + 24,
	unownm: 1404 + 25,
	unownn: 1404 + 26,
	unownp: 1404 + 27,
	unownq: 1404 + 28,
	unownquestion: 1404 + 29,
	unownr: 1404 + 30,
	unowns: 1404 + 31,
	unownt: 1404 + 32,
	unownv: 1404 + 33,
	unownz: 1404 + 34,
	sneasel: 1404 + 35,
	teddiursa: 1404 + 36,
	roselia: 1404 + 37,
	zangoose: 1404 + 38,
	seviper: 1404 + 39,
	castformsnowy: 1404 + 40,
	absolmega: 1404 + 41,
	absol: 1404 + 42,
	regirock: 1404 + 43,
	torterra: 1404 + 44,
	budew: 1404 + 45,
	roserade: 1404 + 46,
	magmortar: 1404 + 47,
	togekiss: 1404 + 48,
	rotomwash: 1404 + 49,
	shayminsky: 1404 + 50,
	emboar: 1404 + 51,
	pansear: 1404 + 52,
	simisear: 1404 + 53,
	drilbur: 1404 + 54,
	excadrill: 1404 + 55,
	sawk: 1404 + 56,
	lilligant: 1404 + 57,
	garbodor: 1404 + 58,
	solosis: 1404 + 59,
	vanilluxe: 1404 + 60,
	amoonguss: 1404 + 61,
	klink: 1404 + 62,
	klang: 1404 + 63,
	klinklang: 1404 + 64,
	litwick: 1404 + 65,
	golett: 1404 + 66,
	golurk: 1404 + 67,
	kyuremblack: 1404 + 68,
	kyuremwhite: 1404 + 69,
	kyurem: 1404 + 70,
	keldeoresolute: 1404 + 71,
	meloetta: 1404 + 72,
	greninja: 1404 + 73,
	greninjabond: 1404 + 73,
	greninjaash: 1404 + 74,
	furfroudebutante: 1404 + 75,
	barbaracle: 1404 + 76,
	clauncher: 1404 + 77,
	clawitzer: 1404 + 78,
	sylveon: 1404 + 79,
	klefki: 1404 + 80,
	zygarde: 1404 + 81,
	zygarde10: 1404 + 82,
	zygardecomplete: 1404 + 83,
	dartrix: 1404 + 84,
	steenee: 1404 + 85,
	tsareena: 1404 + 86,
	comfey: 1404 + 87,
	miniormeteor: 1404 + 88,
	minior: 1404 + 89,
	miniororange: 1404 + 90,
	minioryellow: 1404 + 91,
	miniorgreen: 1404 + 92,
	miniorblue: 1404 + 93,
	miniorviolet: 1404 + 94,
	miniorindigo: 1404 + 95,
	dhelmise: 1404 + 96,
	necrozma: 1404 + 97,
	marshadow: 1404 + 98,
	pikachuoriginal: 1404 + 99,
	pikachupartner: 1404 + 100,
	necrozmaduskmane: 1404 + 101,
	necrozmadawnwings: 1404 + 102,
	necrozmaultra: 1404 + 103,
	stakataka: 1404 + 104,
	blacephalon: 1404 + 105,
};

const BattleAvatarNumbers: {[k: string]: string} = {
	1: 'lucas',
	2: 'dawn',
	3: 'youngster-gen4dp',
	4: 'lass-gen4dp',
	5: 'camper',
	6: 'picnicker',
	7: 'bugcatcher-gen4dp',
	8: 'aromalady',
	9: 'twins-gen4dp',
	10: 'hiker-gen4',
	11: 'battlegirl-gen4',
	12: 'fisherman-gen4',
	13: 'cyclist-gen4',
	14: 'cyclistf-gen4',
	15: 'blackbelt-gen4dp',
	16: 'artist-gen4',
	17: 'pokemonbreeder-gen4',
	18: 'pokemonbreederf-gen4',
	19: 'cowgirl',
	20: 'jogger',
	21: 'pokefan-gen4',
	22: 'pokefanf-gen4',
	23: 'pokekid',
	24: 'youngcouple-gen4dp',
	25: 'acetrainer-gen4dp',
	26: 'acetrainerf-gen4dp',
	27: 'waitress-gen4',
	28: 'veteran-gen4',
	29: 'ninjaboy',
	30: 'dragontamer',
	31: 'birdkeeper-gen4dp',
	32: 'doubleteam',
	33: 'richboy-gen4',
	34: 'lady-gen4',
	35: 'gentleman-gen4dp',
	36: 'madame-gen4dp',
	37: 'beauty-gen4dp',
	38: 'collector',
	39: 'policeman-gen4',
	40: 'pokemonranger-gen4',
	41: 'pokemonrangerf-gen4',
	42: 'scientist-gen4dp',
	43: 'swimmer-gen4dp',
	44: 'swimmerf-gen4dp',
	45: 'tuber',
	46: 'tuberf',
	47: 'sailor',
	48: 'sisandbro',
	49: 'ruinmaniac',
	50: 'psychic-gen4',
	51: 'psychicf-gen4',
	52: 'gambler',
	53: 'guitarist-gen4',
	54: 'acetrainersnow',
	55: 'acetrainersnowf',
	56: 'skier',
	57: 'skierf-gen4dp',
	58: 'roughneck-gen4',
	59: 'clown',
	60: 'worker-gen4',
	61: 'schoolkid-gen4dp',
	62: 'schoolkidf-gen4',
	63: 'roark',
	64: 'barry',
	65: 'byron',
	66: 'aaron',
	67: 'bertha',
	68: 'flint',
	69: 'lucian',
	70: 'cynthia-gen4',
	71: 'bellepa',
	72: 'rancher',
	73: 'mars',
	74: 'galacticgrunt',
	75: 'gardenia',
	76: 'crasherwake',
	77: 'maylene',
	78: 'fantina',
	79: 'candice',
	80: 'volkner',
	81: 'parasollady-gen4',
	82: 'waiter-gen4dp',
	83: 'interviewers',
	84: 'cameraman',
	85: 'reporter',
	86: 'idol',
	87: 'cyrus',
	88: 'jupiter',
	89: 'saturn',
	90: 'galacticgruntf',
	91: 'argenta',
	92: 'palmer',
	93: 'thorton',
	94: 'buck',
	95: 'darach-caitlin',
	96: 'marley',
	97: 'mira',
	98: 'cheryl',
	99: 'riley',
	100: 'dahlia',
	101: 'ethan',
	102: 'lyra',
	103: 'twins-gen4',
	104: 'lass-gen4',
	105: 'acetrainer-gen4',
	106: 'acetrainerf-gen4',
	107: 'juggler',
	108: 'sage',
	109: 'li',
	110: 'gentleman-gen4',
	111: 'teacher',
	112: 'beauty',
	113: 'birdkeeper',
	114: 'swimmer-gen4',
	115: 'swimmerf-gen4',
	116: 'kimonogirl',
	117: 'scientist-gen4',
	118: 'acetrainercouple',
	119: 'youngcouple',
	120: 'supernerd',
	121: 'medium',
	122: 'schoolkid-gen4',
	123: 'blackbelt-gen4',
	124: 'pokemaniac',
	125: 'firebreather',
	126: 'burglar',
	127: 'biker-gen4',
	128: 'skierf',
	129: 'boarder',
	130: 'rocketgrunt',
	131: 'rocketgruntf',
	132: 'archer',
	133: 'ariana',
	134: 'proton',
	135: 'petrel',
	136: 'eusine',
	137: 'lucas-gen4pt',
	138: 'dawn-gen4pt',
	139: 'madame-gen4',
	140: 'waiter-gen4',
	141: 'falkner',
	142: 'bugsy',
	143: 'whitney',
	144: 'morty',
	145: 'chuck',
	146: 'jasmine',
	147: 'pryce',
	148: 'clair',
	149: 'will',
	150: 'koga',
	151: 'bruno',
	152: 'karen',
	153: 'lance',
	154: 'brock',
	155: 'misty',
	156: 'ltsurge',
	157: 'erika',
	158: 'janine',
	159: 'sabrina',
	160: 'blaine',
	161: 'blue',
	162: 'red',
	163: 'red',
	164: 'silver',
	165: 'giovanni',
	166: 'unknownf',
	167: 'unknown',
	168: 'unknown',
	169: 'hilbert',
	170: 'hilda',
	171: 'youngster',
	172: 'lass',
	173: 'schoolkid',
	174: 'schoolkidf',
	175: 'smasher',
	176: 'linebacker',
	177: 'waiter',
	178: 'waitress',
	179: 'chili',
	180: 'cilan',
	181: 'cress',
	182: 'nurseryaide',
	183: 'preschoolerf',
	184: 'preschooler',
	185: 'twins',
	186: 'pokemonbreeder',
	187: 'pokemonbreederf',
	188: 'lenora',
	189: 'burgh',
	190: 'elesa',
	191: 'clay',
	192: 'skyla',
	193: 'pokemonranger',
	194: 'pokemonrangerf',
	195: 'worker',
	196: 'backpacker',
	197: 'backpackerf',
	198: 'fisherman',
	199: 'musician',
	200: 'dancer',
	201: 'harlequin',
	202: 'artist',
	203: 'baker',
	204: 'psychic',
	205: 'psychicf',
	206: 'cheren',
	207: 'bianca',
	208: 'plasmagrunt-gen5bw',
	209: 'n',
	210: 'richboy',
	211: 'lady',
	212: 'pilot',
	213: 'workerice',
	214: 'hoopster',
	215: 'scientistf',
	216: 'clerkf',
	217: 'acetrainerf',
	218: 'acetrainer',
	219: 'blackbelt',
	220: 'scientist',
	221: 'striker',
	222: 'brycen',
	223: 'iris',
	224: 'drayden',
	225: 'roughneck',
	226: 'janitor',
	227: 'pokefan',
	228: 'pokefanf',
	229: 'doctor',
	230: 'nurse',
	231: 'hooligans',
	232: 'battlegirl',
	233: 'parasollady',
	234: 'clerk',
	235: 'clerk-boss',
	236: 'backers',
	237: 'backersf',
	238: 'veteran',
	239: 'veteranf',
	240: 'biker',
	241: 'infielder',
	242: 'hiker',
	243: 'madame',
	244: 'gentleman',
	245: 'plasmagruntf-gen5bw',
	246: 'shauntal',
	247: 'marshal',
	248: 'grimsley',
	249: 'caitlin',
	250: 'ghetsis-gen5bw',
	251: 'depotagent',
	252: 'swimmer',
	253: 'swimmerf',
	254: 'policeman',
	255: 'maid',
	256: 'ingo',
	257: 'alder',
	258: 'cyclist',
	259: 'cyclistf',
	260: 'cynthia',
	261: 'emmet',
	262: 'hilbert-wonderlauncher',
	263: 'hilda-wonderlauncher',
	264: 'hugh',
	265: 'rosa',
	266: 'nate',
	267: 'colress',
	268: 'beauty-gen5bw2',
	269: 'ghetsis',
	270: 'plasmagrunt',
	271: 'plasmagruntf',
	272: 'iris-gen5bw2',
	273: 'brycenman',
	274: 'shadowtriad',
	275: 'rood',
	276: 'zinzolin',
	277: 'cheren-gen5bw2',
	278: 'marlon',
	279: 'roxie',
	280: 'roxanne',
	281: 'brawly',
	282: 'wattson',
	283: 'flannery',
	284: 'norman',
	285: 'winona',
	286: 'tate',
	287: 'liza',
	288: 'juan',
	289: 'guitarist',
	290: 'steven',
	291: 'wallace',
	292: 'bellelba',
	293: 'benga',
	294: 'ash',
	'#bw2elesa': 'elesa-gen5bw2',
	'#teamrocket': 'teamrocket',
	'#yellow': 'yellow',
	'#zinnia': 'zinnia',
	'#clemont': 'clemont',
	'#wally': 'wally',
	breeder: 'pokemonbreeder',
	breederf: 'pokemonbreederf',
	'hilbert-dueldisk': 'hilbert-wonderlauncher',
	'hilda-dueldisk': 'hilda-wonderlauncher',
	'nate-dueldisk': 'nate-wonderlauncher',
	'rosa-dueldisk': 'rosa-wonderlauncher',

	1001: '#1001',
	1002: '#1002',
	1003: '#1003',
	1005: '#1005',
	1010: '#1010',
};

type StatName = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
type NatureName = 'Adamant' | 'Bashful' | 'Bold' | 'Brave' | 'Calm' | 'Careful' | 'Docile' | 'Gentle' |
	'Hardy' | 'Hasty' | 'Impish' | 'Jolly' | 'Lax' | 'Lonely' | 'Mild' | 'Modest' | 'Naive' | 'Naughty' |
	'Quiet' | 'Quirky' | 'Rash' | 'Relaxed' | 'Sassy' | 'Serious' | 'Timid';
type StatNameExceptHP = 'atk' | 'def' | 'spa' | 'spd' | 'spe';
type TypeName = 'Normal' | 'Fighting' | 'Flying' | 'Poison' | 'Ground' | 'Rock' | 'Bug' | 'Ghost' | 'Steel' |
	'Fire' | 'Water' | 'Grass' | 'Electric' | 'Psychic' | 'Ice' | 'Dragon' | 'Dark' | 'Fairy' | 'Stellar' | '???';
type StatusName = 'par' | 'psn' | 'frz' | 'slp' | 'brn';
type BoostStatName = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'evasion' | 'accuracy' | 'spc';
type GenderName = 'M' | 'F' | 'N';

interface Effect {
	readonly id: ID;
	readonly name: string;
	readonly gen: number;
	readonly effectType: 'Item' | 'Move' | 'Ability' | 'Species' | 'PureEffect';
	/**
	 * Do we have data on this item/move/ability/species?
	 * WARNING: Always false if the relevant data files aren't loaded.
	 */
	readonly exists: boolean;
}

class PureEffect implements Effect {
	readonly effectType = 'PureEffect';
	readonly id: ID;
	readonly name: string;
	readonly gen: number;
	readonly exists: boolean;
	constructor(id: ID, name: string) {
		this.id = id;
		this.name = name;
		this.gen = 0;
		this.exists = false;
	}
}

class Item implements Effect {
	// effect
	readonly effectType = 'Item';
	readonly id: ID;
	readonly name: string;
	readonly gen: number;
	readonly exists: boolean;

	readonly num: number;
	readonly spritenum: number;
	readonly desc: string;
	readonly shortDesc: string;

	readonly megaStone: string;
	readonly megaEvolves: string;
	readonly zMove: string | true | null;
	readonly zMoveType: TypeName | '';
	readonly zMoveFrom: string;
	readonly zMoveUser: readonly string[] | null;
	readonly onPlate: TypeName;
	readonly onMemory: TypeName;
	readonly onDrive: TypeName;
	readonly fling: any;
	readonly naturalGift: any;
	readonly isPokeball: boolean;
	readonly itemUser?: readonly string[];

	constructor(id: ID, name: string, data: any) {
		if (!data || typeof data !== 'object') data = {};
		if (data.name) name = data.name;
		this.name = Dex.sanitizeName(name);
		this.id = id;
		this.gen = data.gen || 0;
		this.exists = ('exists' in data ? !!data.exists : true);

		this.num = data.num || 0;
		this.spritenum = data.spritenum || 0;
		this.desc = data.desc || data.shortDesc || '';
		this.shortDesc = data.shortDesc || this.desc;

		this.megaStone = data.megaStone || '';
		this.megaEvolves = data.megaEvolves || '';
		this.zMove = data.zMove || null;
		this.zMoveType = data.zMoveType || '';
		this.zMoveFrom = data.zMoveFrom || '';
		this.zMoveUser = data.zMoveUser || null;
		this.onPlate = data.onPlate || '';
		this.onMemory = data.onMemory || '';
		this.onDrive = data.onDrive || '';
		this.fling = data.fling || null;
		this.naturalGift = data.naturalGift || null;
		this.isPokeball = !!data.isPokeball;
		this.itemUser = data.itemUser;

		if (!this.gen) {
			if (this.num >= 577) {
				this.gen = 6;
			} else if (this.num >= 537) {
				this.gen = 5;
			} else if (this.num >= 377) {
				this.gen = 4;
			} else {
				this.gen = 3;
			}
		}
	}
}

interface MoveFlags {
	/** The move has an animation when used on an ally. */
	allyanim?: 1 | 0;
	/** Power is multiplied by 1.5 when used by a Pokemon with the Strong Jaw Ability. */
	bite?: 1 | 0;
	/** Has no effect on Pokemon with the Bulletproof Ability. */
	bullet?: 1 | 0;
	/** Ignores a target's substitute. */
	bypasssub?: 1 | 0;
	/** The user is unable to make a move between turns. */
	charge?: 1 | 0;
	/** Makes contact. */
	contact?: 1 | 0;
	/** When used by a Pokemon, other Pokemon with the Dancer Ability can attempt to execute the same move. */
	dance?: 1 | 0;
	/** Thaws the user if executed successfully while the user is frozen. */
	defrost?: 1 | 0;
	/** Can target a Pokemon positioned anywhere in a Triple Battle. */
	distance?: 1 | 0;
	/** Prevented from being executed or selected during Gravity's effect. */
	gravity?: 1 | 0;
	/** Prevented from being executed or selected during Heal Block's effect. */
	heal?: 1 | 0;
	/** Can be copied by Mirror Move. */
	mirror?: 1 | 0;
	/** Prevented from being executed or selected in a Sky Battle. */
	nonsky?: 1 | 0;
	/** Cannot be copied by Sketch */
	nosketch?: 1 | 0;
	/** Has no effect on Grass-type Pokemon, Pokemon with the Overcoat Ability, and Pokemon holding Safety Goggles. */
	powder?: 1 | 0;
	/** Blocked by Detect, Protect, Spiky Shield, and if not a Status move, King's Shield. */
	protect?: 1 | 0;
	/** Power is multiplied by 1.5 when used by a Pokemon with the Mega Launcher Ability. */
	pulse?: 1 | 0;
	/** Power is multiplied by 1.2 when used by a Pokemon with the Iron Fist Ability. */
	punch?: 1 | 0;
	/** If this move is successful, the user must recharge on the following turn and cannot make a move. */
	recharge?: 1 | 0;
	/** Bounced back to the original user by Magic Coat or the Magic Bounce Ability. */
	reflectable?: 1 | 0;
	/** Power is multiplied by 1.5 when used by a Pokemon with the Sharpness Ability. */
	slicing?: 1 | 0;
	/** Can be stolen from the original user and instead used by another Pokemon using Snatch. */
	snatch?: 1 | 0;
	/** Has no effect on Pokemon with the Soundproof Ability. */
	sound?: 1 | 0;
	/** Activates the effects of the Wind Power and Wind Rider Abilities. */
	wind?: 1 | 0;
}

type MoveTarget = 'normal' | 'any' | 'adjacentAlly' | 'adjacentFoe' | 'adjacentAllyOrSelf' | // single-target
	'self' | 'randomNormal' | // single-target, automatic
	'allAdjacent' | 'allAdjacentFoes' | // spread
	'allySide' | 'foeSide' | 'all'; // side and field

class Move implements Effect {
	// effect
	readonly effectType = 'Move';
	readonly id: ID;
	readonly name: string;
	readonly gen: number;
	readonly exists: boolean;

	readonly basePower: number;
	readonly accuracy: number | true;
	readonly pp: number;
	readonly type: TypeName;
	readonly category: 'Physical' | 'Special' | 'Status';
	readonly priority: number;
	readonly target: MoveTarget;
	readonly pressureTarget: MoveTarget;
	readonly flags: Readonly<MoveFlags>;
	readonly critRatio: number;

	readonly desc: string;
	readonly shortDesc: string;
	readonly isNonstandard: string | null;
	readonly isZ: ID;
	readonly zMove?: {
		basePower?: number,
		effect?: string,
		boost?: {[stat in StatName]?: number},
	};
	readonly isMax: boolean | string;
	readonly maxMove: {basePower: number};
	readonly ohko: true | 'Ice' | null;
	readonly recoil: number[] | null;
	readonly heal: number[] | null;
	readonly multihit: number[] | number | null;
	readonly hasCrashDamage: boolean;
	readonly basePowerCallback: boolean;
	readonly noPPBoosts: boolean;
	readonly status: string;
	readonly secondaries: ReadonlyArray<any> | null;
	readonly num: number;

	constructor(id: ID, name: string, data: any) {
		if (!data || typeof data !== 'object') data = {};
		if (data.name) name = data.name;
		this.name = Dex.sanitizeName(name);
		this.id = id;
		this.gen = data.gen || 0;
		this.exists = ('exists' in data ? !!data.exists : true);

		this.basePower = data.basePower || 0;
		this.accuracy = data.accuracy || 0;
		this.pp = data.pp || 1;
		this.type = data.type || '???';
		this.category = data.category || 'Physical';
		this.priority = data.priority || 0;
		this.target = data.target || 'normal';
		this.pressureTarget = data.pressureTarget || this.target;
		this.flags = data.flags || {};
		this.critRatio = data.critRatio === 0 ? 0 : (data.critRatio || 1);

		// TODO: move to text.js
		this.desc = data.desc;
		this.shortDesc = data.shortDesc;
		this.isNonstandard = data.isNonstandard || null;
		this.isZ = data.isZ || '';
		this.zMove = data.zMove || {};
		this.ohko = data.ohko || null;
		this.recoil = data.recoil || null;
		this.heal = data.heal || null;
		this.multihit = data.multihit || null;
		this.hasCrashDamage = data.hasCrashDamage || false;
		this.basePowerCallback = !!data.basePowerCallback;
		this.noPPBoosts = data.noPPBoosts || false;
		this.status = data.status || '';
		this.secondaries = data.secondaries || (data.secondary ? [data.secondary] : null);

		this.isMax = data.isMax || false;
		this.maxMove = data.maxMove || {basePower: 0};
		if (this.category !== 'Status' && !this.maxMove?.basePower) {
			if (this.isZ || this.isMax) {
				this.maxMove = {basePower: 1};
			} else if (!this.basePower) {
				this.maxMove = {basePower: 100};
			} else if (['Fighting', 'Poison'].includes(this.type)) {
				if (this.basePower >= 150) {
					this.maxMove = {basePower: 100};
				} else if (this.basePower >= 110) {
					this.maxMove = {basePower: 95};
				} else if (this.basePower >= 75) {
					this.maxMove = {basePower: 90};
				} else if (this.basePower >= 65) {
					this.maxMove = {basePower: 85};
				} else if (this.basePower >= 55) {
					this.maxMove = {basePower: 80};
				} else if (this.basePower >= 45) {
					this.maxMove = {basePower: 75};
				} else  {
					this.maxMove = {basePower: 70};
				}
			} else {
				if (this.basePower >= 150) {
					this.maxMove = {basePower: 150};
				} else if (this.basePower >= 110) {
					this.maxMove = {basePower: 140};
				} else if (this.basePower >= 75) {
					this.maxMove = {basePower: 130};
				} else if (this.basePower >= 65) {
					this.maxMove = {basePower: 120};
				} else if (this.basePower >= 55) {
					this.maxMove = {basePower: 110};
				} else if (this.basePower >= 45) {
					this.maxMove = {basePower: 100};
				} else  {
					this.maxMove = {basePower: 90};
				}
			}
		}

		if (this.category !== 'Status' && !this.isZ && !this.isMax) {
			let basePower = this.basePower;
			this.zMove = {};
			if (Array.isArray(this.multihit)) basePower *= 3;
			if (!basePower) {
				this.zMove.basePower = 100;
			} else if (basePower >= 140) {
				this.zMove.basePower = 200;
			} else if (basePower >= 130) {
				this.zMove.basePower = 195;
			} else if (basePower >= 120) {
				this.zMove.basePower = 190;
			} else if (basePower >= 110) {
				this.zMove.basePower = 185;
			} else if (basePower >= 100) {
				this.zMove.basePower = 180;
			} else if (basePower >= 90) {
				this.zMove.basePower = 175;
			} else if (basePower >= 80) {
				this.zMove.basePower = 160;
			} else if (basePower >= 70) {
				this.zMove.basePower = 140;
			} else if (basePower >= 60) {
				this.zMove.basePower = 120;
			} else {
				this.zMove.basePower = 100;
			}
			if (data.zMove) this.zMove.basePower = data.zMove.basePower;
		}

		this.num = data.num || 0;
		if (!this.gen) {
			if (this.num >= 743) {
				this.gen = 8;
			} else if (this.num >= 622) {
				this.gen = 7;
			} else if (this.num >= 560) {
				this.gen = 6;
			} else if (this.num >= 468) {
				this.gen = 5;
			} else if (this.num >= 355) {
				this.gen = 4;
			} else if (this.num >= 252) {
				this.gen = 3;
			} else if (this.num >= 166) {
				this.gen = 2;
			} else if (this.num >= 1) {
				this.gen = 1;
			}
		}
	}
}

interface AbilityFlags {
	/** Can be suppressed by Mold Breaker and related effects */
	breakable?: 1;
	/** Ability can't be suppressed by e.g. Gastro Acid or Neutralizing Gas */
	cantsuppress?: 1;
	/** Role Play fails if target has this Ability */
	failroleplay?: 1;
	/** Skill Swap fails if either the user or target has this Ability */
	failskillswap?: 1;
	/** Entrainment fails if user has this Ability */
	noentrain?: 1;
	/** Receiver and Power of Alchemy will not activate if an ally faints with this Ability */
	noreceiver?: 1;
	/** Trace cannot copy this Ability */
	notrace?: 1;
	/** Disables the Ability if the user is Transformed */
	notransform?: 1;
}

class Ability implements Effect {
	// effect
	readonly effectType = 'Ability';
	readonly id: ID;
	readonly name: string;
	readonly gen: number;
	readonly exists: boolean;

	readonly num: number;
	readonly shortDesc: string;
	readonly desc: string;

	readonly rating: number;
	readonly flags: AbilityFlags;
	readonly isNonstandard: boolean;

	constructor(id: ID, name: string, data: any) {
		if (!data || typeof data !== 'object') data = {};
		if (data.name) name = data.name;
		this.name = Dex.sanitizeName(name);
		this.id = id;
		this.gen = data.gen || 0;
		this.exists = ('exists' in data ? !!data.exists : true);
		this.num = data.num || 0;
		this.shortDesc = data.shortDesc || data.desc || '';
		this.desc = data.desc || data.shortDesc || '';
		this.rating = data.rating || 1;
		this.flags = data.flags || {};
		this.isNonstandard = !!data.isNonstandard;
		if (!this.gen) {
			if (this.num >= 234) {
				this.gen = 8;
			} else if (this.num >= 192) {
				this.gen = 7;
			} else if (this.num >= 165) {
				this.gen = 6;
			} else if (this.num >= 124) {
				this.gen = 5;
			} else if (this.num >= 77) {
				this.gen = 4;
			} else if (this.num >= 1) {
				this.gen = 3;
			}
		}
	}
}

class Species implements Effect {
	// effect
	readonly effectType = 'Species';
	readonly id: ID;
	readonly name: string;
	readonly gen: number;
	readonly exists: boolean;

	// name
	readonly baseSpecies: string;
	readonly forme: string;
	readonly formeid: string;
	readonly spriteid: string;
	readonly baseForme: string;

	// basic data
	readonly num: number;
	readonly types: ReadonlyArray<TypeName>;
	readonly abilities: Readonly<{
		0: string, 1?: string, H?: string, S?: string,
	}>;
	readonly baseStats: Readonly<{
		hp: number, atk: number, def: number, spa: number, spd: number, spe: number,
	}>;
	readonly bst: number;
	readonly weightkg: number;

	// flavor data
	readonly heightm: number;
	readonly gender: GenderName;
	readonly color: string;
	readonly genderRatio: Readonly<{M: number, F: number}> | null;
	readonly eggGroups: ReadonlyArray<string>;
	readonly tags: ReadonlyArray<string>;

	// format data
	readonly otherFormes: ReadonlyArray<string> | null;
	readonly cosmeticFormes: ReadonlyArray<string> | null;
	readonly evos: ReadonlyArray<string> | null;
	readonly prevo: string;
	readonly evoType: 'trade' | 'useItem' | 'levelMove' | 'levelExtra' | 'levelFriendship' | 'levelHold' | 'other' | '';
	readonly evoLevel: number;
	readonly evoMove: string;
	readonly evoItem: string;
	readonly evoCondition: string;
	readonly requiredItems: ReadonlyArray<string>;
	readonly tier: string;
	readonly isTotem: boolean;
	readonly isMega: boolean;
	readonly isPrimal: boolean;
	readonly canGigantamax: boolean;
	readonly cannotDynamax: boolean;
	readonly requiredTeraType: TypeName;
	readonly battleOnly: string | string[] | undefined;
	readonly isNonstandard: string | null;
	readonly unreleasedHidden: boolean | 'Past';
	readonly changesFrom: string | undefined;

	constructor(id: ID, name: string, data: any) {
		if (!data || typeof data !== 'object') data = {};
		if (data.name) name = data.name;
		this.name = Dex.sanitizeName(name);
		this.id = id;
		this.gen = data.gen || 0;
		this.exists = ('exists' in data ? !!data.exists : true);
		this.baseSpecies = data.baseSpecies || name;
		this.forme = data.forme || '';
		const baseId = toID(this.baseSpecies);
		this.formeid = (baseId === this.id ? '' : '-' + toID(this.forme));
		this.spriteid = baseId + this.formeid;
		if (this.spriteid.slice(-5) === 'totem') this.spriteid = this.spriteid.slice(0, -5);
		if (this.spriteid === 'greninja-bond') this.spriteid = 'greninja';
		if (this.spriteid.slice(-1) === '-') this.spriteid = this.spriteid.slice(0, -1);
		this.baseForme = data.baseForme || '';

		this.num = data.num || 0;
		this.types = data.types || ['???'];
		this.abilities = data.abilities || {0: "No Ability"};
		this.baseStats = data.baseStats || {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0};
		this.bst = this.baseStats.hp + this.baseStats.atk + this.baseStats.def +
			this.baseStats.spa + this.baseStats.spd + this.baseStats.spe;
		this.weightkg = data.weightkg || 0;

		this.heightm = data.heightm || 0;
		this.gender = data.gender || '';
		this.color = data.color || '';
		this.genderRatio = data.genderRatio || null;
		this.eggGroups = data.eggGroups || [];
		this.tags = data.tags || [];

		this.otherFormes = data.otherFormes || null;
		this.cosmeticFormes = data.cosmeticFormes || null;
		this.evos = data.evos || null;
		this.prevo = data.prevo || '';
		this.evoType = data.evoType || '';
		this.evoLevel = data.evoLevel || 0;
		this.evoMove = data.evoMove || '';
		this.evoItem = data.evoItem || '';
		this.evoCondition = data.evoCondition || '';
		this.requiredItems = data.requiredItems || (data.requiredItem ? [data.requiredItem] : []);
		this.tier = data.tier || '';

		this.isTotem = false;
		this.isMega = !!(this.forme && ['-mega', '-megax', '-megay'].includes(this.formeid));
		this.isPrimal = !!(this.forme && this.formeid === '-primal');
		this.canGigantamax = !!data.canGigantamax;
		this.cannotDynamax = !!data.cannotDynamax;
		this.requiredTeraType = data.requiredTeraType || '';
		this.battleOnly = data.battleOnly || (this.isMega ? this.baseSpecies : undefined);
		this.isNonstandard = data.isNonstandard || null;
		this.unreleasedHidden = data.unreleasedHidden || false;
		this.changesFrom = data.changesFrom ||
			(this.battleOnly !== this.baseSpecies ? this.battleOnly : this.baseSpecies);
		if (!this.gen) {
			if (this.num >= 906 || this.formeid.startsWith('-paldea')) {
				this.gen = 9;
			} else if (this.num >= 810 || this.formeid.startsWith('-galar') || this.formeid.startsWith('-hisui')) {
				this.gen = 8;
			} else if (this.num >= 722 || this.formeid === '-alola' || this.formeid === '-starter') {
				this.gen = 7;
			} else if (this.isMega || this.isPrimal) {
				this.gen = 6;
				this.battleOnly = this.baseSpecies;
			} else if (this.formeid === '-totem' || this.formeid === '-alolatotem') {
				this.gen = 7;
				this.isTotem = true;
			} else if (this.num >= 650) {
				this.gen = 6;
			} else if (this.num >= 494) {
				this.gen = 5;
			} else if (this.num >= 387) {
				this.gen = 4;
			} else if (this.num >= 252) {
				this.gen = 3;
			} else if (this.num >= 152) {
				this.gen = 2;
			} else if (this.num >= 1) {
				this.gen = 1;
			}
		}
	}
}

interface Type extends Effect {
	damageTaken?: AnyObject;
	HPivs?: Partial<StatsTable>;
	HPdvs?: Partial<StatsTable>;
}

if (typeof require === 'function') {
	// in Node
	(global as any).BattleBaseSpeciesChart = BattleBaseSpeciesChart;
	(global as any).BattleNatures = BattleNatures;
	(global as any).PureEffect = PureEffect;
	(global as any).Species = Species;
	(global as any).Ability = Ability;
	(global as any).Item = Item;
	(global as any).Move = Move;
}
