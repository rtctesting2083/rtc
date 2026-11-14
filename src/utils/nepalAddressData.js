// Comprehensive Nepal Administrative Address Data
// Covering all 7 Provinces, 77 Districts, and authentic Local Levels (Municipalities / Gaunpalikas)

export const NEPAL_PROVINCES = [
  'Koshi',
  'Madhesh',
  'Bagmati',
  'Gandaki',
  'Lumbini',
  'Karnali',
  'Sudurpashchim',
];

export const NEPAL_DISTRICTS = {
  Koshi: [
    'Bhojpur',
    'Dhankuta',
    'Ilam',
    'Jhapa',
    'Khotang',
    'Morang',
    'Okhaldhunga',
    'Panchthar',
    'Sankhuwasabha',
    'Solukhumbu',
    'Sunsari',
    'Taplejung',
    'Terhathum',
    'Udayapur',
  ],
  Madhesh: [
    'Bara',
    'Dhanusha',
    'Mahottari',
    'Parsa',
    'Rautahat',
    'Saptari',
    'Sarlahi',
    'Siraha',
  ],
  Bagmati: [
    'Bhaktapur',
    'Chitwan',
    'Dhading',
    'Dolakha',
    'Kathmandu',
    'Kavrepalanchok',
    'Lalitpur',
    'Makwanpur',
    'Nuwakot',
    'Ramechhap',
    'Rasuwa',
    'Sindhuli',
    'Sindhupalchok',
  ],
  Gandaki: [
    'Baglung',
    'Gorkha',
    'Kaski',
    'Lamjung',
    'Manang',
    'Mustang',
    'Myagdi',
    'Nawalpur',
    'Parbat',
    'Syangja',
    'Tanahun',
  ],
  Lumbini: [
    'Arghakhanchi',
    'Banke',
    'Bardiya',
    'Dang',
    'Eastern Rukum',
    'Gulmi',
    'Kapilvastu',
    'Palpa',
    'Parasi',
    'Pyuthan',
    'Rolpa',
    'Rupandehi',
  ],
  Karnali: [
    'Dailekh',
    'Dolpa',
    'Humla',
    'Jajarkot',
    'Jumla',
    'Kalikot',
    'Mugu',
    'Salyan',
    'Surkhet',
    'Western Rukum',
  ],
  Sudurpashchim: [
    'Achham',
    'Baitadi',
    'Bajhang',
    'Bajura',
    'Dadeldhura',
    'Darchula',
    'Doti',
    'Kailali',
    'Kanchanpur',
  ],
};

// District to Province mapping for fast reverse lookup
export const DISTRICT_TO_PROVINCE = {};
Object.entries(NEPAL_DISTRICTS).forEach(([province, districts]) => {
  districts.forEach((district) => {
    DISTRICT_TO_PROVINCE[district.toLowerCase()] = province;
    DISTRICT_TO_PROVINCE[district] = province;
  });
});

// Comprehensive Local Levels (Metropolitan, Sub-Metropolitan, Municipality, Rural Municipality) for all 77 Districts
export const NEPAL_MUNICIPALITIES = {
  // Koshi Province (14 Districts)
  Bhojpur: [
    'Bhojpur Municipality',
    'Shadanand Municipality',
    'Hatuwagadhi Rural Municipality',
    'Ramprasad Rai Rural Municipality',
    'Aamchok Rural Municipality',
    'Tyamke Maiyum Rural Municipality',
    'Arun Rural Municipality',
    'Pauwadungma Rural Municipality',
    'Salpasilichho Rural Municipality',
  ],
  Dhankuta: [
    'Dhankuta Municipality',
    'Pakhribas Municipality',
    'Mahalaxmi Municipality',
    'Sangurigadhi Rural Municipality',
    'Chaubise Rural Municipality',
    'Shahidbhumi Rural Municipality',
    'Chhathar Jorpati Rural Municipality',
  ],
  Ilam: [
    'Ilam Municipality',
    'Deumai Municipality',
    'Mai Municipality',
    'Suryodaya Municipality',
    'Phakphokthum Rural Municipality',
    'Maijogmai Rural Municipality',
    'Chulachuli Rural Municipality',
    'Rong Rural Municipality',
    'Mangsebung Rural Municipality',
    'Sandakpur Rural Municipality',
  ],
  Jhapa: [
    'Bhadrapur Municipality',
    'Birtamod Municipality',
    'Damak Municipality',
    'Mechinagar Municipality',
    'Arjundhara Municipality',
    'Kankai Municipality',
    'Shivasatakshi Municipality',
    'Gauradaha Municipality',
    'Barhadashi Rural Municipality',
    'Jhapa Rural Municipality',
    'Buddhashanti Rural Municipality',
    'Haldibari Rural Municipality',
    'Kachankawal Rural Municipality',
    'Kamal Rural Municipality',
    'Gaurigunj Rural Municipality',
  ],
  Khotang: [
    'Diktel Rupakot Majhuwagadhi Municipality',
    'Halesi Tuwachung Municipality',
    'Khotehang Rural Municipality',
    'Diprung Chuichumma Rural Municipality',
    'Aiselukharka Rural Municipality',
    'Jantedhunga Rural Municipality',
    'Rawabesi Rural Municipality',
    'Barahapokhari Rural Municipality',
    'Sakela Rural Municipality',
    'Kepilasgadhi Rural Municipality',
  ],
  Morang: [
    'Biratnagar Metropolitan City',
    'Belbari Municipality',
    'Letang Municipality',
    'Pathari Sanischare Municipality',
    'Rangeli Municipality',
    'Ratuwamai Municipality',
    'Sundar Haraicha Municipality',
    'Sunbarshi Municipality',
    'Urlabari Municipality',
    'Budhiganga Rural Municipality',
    'Dhanpalthan Rural Municipality',
    'Gramthan Rural Municipality',
    'Jahada Rural Municipality',
    'Kanepokhari Rural Municipality',
    'Katahari Rural Municipality',
    'Kerabari Rural Municipality',
    'Miklajung Rural Municipality',
  ],
  Okhaldhunga: [
    'Siddhicharan Municipality',
    'Champadevi Rural Municipality',
    'Chisankhugadhi Rural Municipality',
    'Khijidemba Rural Municipality',
    'Manebhanjyang Rural Municipality',
    'Molung Rural Municipality',
    'Likhu Rural Municipality',
    'Sunkoshi Rural Municipality',
  ],
  Panchthar: [
    'Phidim Municipality',
    'Falelung Rural Municipality',
    'Falgunanda Rural Municipality',
    'Hilihang Rural Municipality',
    'Kummayak Rural Municipality',
    'Miklajung Rural Municipality',
    'Tumbewa Rural Municipality',
    'Yangwarak Rural Municipality',
  ],
  Sankhuwasabha: [
    'Chainpur Municipality',
    'Dharmadevi Municipality',
    'Khandbari Municipality',
    'Madi Municipality',
    'Panchakhapan Municipality',
    'Bhotkhola Rural Municipality',
    'Chichila Rural Municipality',
    'Makalu Rural Municipality',
    'Sabha Pokhari Rural Municipality',
    'Silichong Rural Municipality',
  ],
  Solukhumbu: [
    'Soludhudhkunda Municipality',
    'Dudhkoshi Rural Municipality',
    'Khumbu Pasanglhamu Rural Municipality',
    'Dudhkaushika Rural Municipality',
    'Nechasalyan Rural Municipality',
    'Mahakulung Rural Municipality',
    'Likhu Pike Rural Municipality',
    'Sotang Rural Municipality',
  ],
  Sunsari: [
    'Dharan Sub-Metropolitan City',
    'Itahari Sub-Metropolitan City',
    'Inaruwa Municipality',
    'Barahachhetra Municipality',
    'Duhabi Municipality',
    'Ramdhuni Municipality',
    'Dewanganj Rural Municipality',
    'Koshi Rural Municipality',
    'Gadhi Rural Municipality',
    'Barju Rural Municipality',
    'Bhokraha Narasimha Rural Municipality',
    'Harinagar Rural Municipality',
  ],
  Taplejung: [
    'Phungling Municipality',
    'Aathrai Tribeni Rural Municipality',
    'Sidingba Rural Municipality',
    'Phaktanglung Rural Municipality',
    'Mikwakhola Rural Municipality',
    'Meringden Rural Municipality',
    'Maiwakhola Rural Municipality',
    'Sirijangha Rural Municipality',
    'Pathibhara Yangwarak Rural Municipality',
  ],
  Terhathum: [
    'Myanglung Municipality',
    'Laligurans Municipality',
    'Aathrai Rural Municipality',
    'Chhathar Rural Municipality',
    'Menchayayem Rural Municipality',
    'Phedap Rural Municipality',
  ],
  Udayapur: [
    'Triyuga Municipality',
    'Katari Municipality',
    'Chaudandigadhi Municipality',
    'Belaka Municipality',
    'Udayapurgadhi Rural Municipality',
    'Rautamai Rural Municipality',
    'Tapli Rural Municipality',
    'Limchungbung Rural Municipality',
  ],

  // Madhesh Province (8 Districts)
  Saptari: [
    'Rajbiraj Municipality',
    'Kanchanrup Municipality',
    'Dakneshwori Municipality',
    'Bodebarsain Municipality',
    'Khadak Municipality',
    'Shambhunath Municipality',
    'Surunga Municipality',
    'Hanumannagar Kankalini Municipality',
    'Saptakoshi Municipality',
    'Agnisair Krishna Savaran Rural Municipality',
    'Chhinnamasta Rural Municipality',
    'Mahadeva Rural Municipality',
    'Tirahut Rural Municipality',
    'Tilathi Koiladi Rural Municipality',
    'Rupani Rural Municipality',
    'Bishnupur Rural Municipality',
    'Balan-Bihul Rural Municipality',
  ],
  Siraha: [
    'Siraha Municipality',
    'Lahan Municipality',
    'Golbazar Municipality',
    'Mirchaiya Municipality',
    'Kalyanpur Municipality',
    'Dhangadhimai Municipality',
    'Sukhipur Municipality',
    'Karjanha Municipality',
    'Bhagwanpur Rural Municipality',
    'Aurahi Rural Municipality',
    'Bishnupur Rural Municipality',
    'Bariyarpatti Rural Municipality',
    'Lakshmipur Patari Rural Municipality',
    'Naraha Rural Municipality',
    'Sakhuwanankarkatti Rural Municipality',
    'Arnama Rural Municipality',
    'Navarajpur Rural Municipality',
  ],
  Dhanusha: [
    'Janakpur Sub-Metropolitan City',
    'Dhanusadham Municipality',
    'Chhireshwarnath Municipality',
    'Ganeshman Charnath Municipality',
    'Mithila Municipality',
    'Shahidnagar Municipality',
    'Sabaila Municipality',
    'Kamala Municipality',
    'Mithila Bihari Municipality',
    'Hansapur Municipality',
    'Bideha Municipality',
    'Nagarain Municipality',
    'Allau Municipality',
    'Bateshwar Rural Municipality',
    'Janaknandani Rural Municipality',
    'Mukhiyapatti Musaharmiya Rural Municipality',
    'Lakshminiya Rural Municipality',
    'Aurahi Rural Municipality',
  ],
  Mahottari: [
    'Jaleshwor Municipality',
    'Bardibas Municipality',
    'Gaushala Municipality',
    'Loharpatti Municipality',
    'Ramgopalpur Municipality',
    'Manara Shisawa Municipality',
    'Matihani Municipality',
    'Bhangaha Municipality',
    'Balwa Municipality',
    'Pipara Rural Municipality',
    'Samsi Rural Municipality',
    'Sonama Rural Municipality',
    'Ekdara Rural Municipality',
    'Mahottari Rural Municipality',
  ],
  Sarlahi: [
    'Malangwa Municipality',
    'Hariwan Municipality',
    'Ishwarpur Municipality',
    'Lalbandi Municipality',
    'Barahathwa Municipality',
    'Haripur Municipality',
    'Bagmati Municipality',
    'Kabilasi Municipality',
    'Godaita Municipality',
    'Balara Municipality',
    'Chandranagar Rural Municipality',
    'Brahmapuri Rural Municipality',
    'Ramnagar Rural Municipality',
    'Chakraghatta Rural Municipality',
    'Kaudena Rural Municipality',
    'Dhankaul Rural Municipality',
    'Bishnu Rural Municipality',
    'Basbariya Rural Municipality',
    'Parsa Rural Municipality',
  ],
  Rautahat: [
    'Gaur Municipality',
    'Chandrapur Municipality',
    'Garuda Municipality',
    'Gujara Municipality',
    'Brindaban Municipality',
    'Dewahi Gonahi Municipality',
    'Gadhimai Municipality',
    'Madhav Narayan Municipality',
    'Maulapur Municipality',
    'Paroha Municipality',
    'Phatuwa Bijayapur Municipality',
    'Baudhimai Municipality',
    'Rajpur Municipality',
    'Rajdevi Municipality',
    'Ishnath Municipality',
    'Durga Bhagwati Rural Municipality',
    'Yamunamai Rural Municipality',
  ],
  Bara: [
    'Kalaiya Sub-Metropolitan City',
    'Jitpur Simara Sub-Metropolitan City',
    'Kolhabi Municipality',
    'Nijgadh Municipality',
    'Mahagadhimai Municipality',
    'Simraungadh Municipality',
    'Pacharauta Municipality',
    'Pheta Rural Municipality',
    'Bishrampur Rural Municipality',
    'Prasauni Rural Municipality',
    'Adarsh Kotwal Rural Municipality',
    'Karaiyamai Rural Municipality',
    'Devtal Rural Municipality',
    'Parwanipur Rural Municipality',
    'Baragadhi Rural Municipality',
    'Suwarna Rural Municipality',
  ],
  Parsa: [
    'Birgunj Metropolitan City',
    'Pokhariya Municipality',
    'Bahudarmai Municipality',
    'Parsagadhi Municipality',
    'Bindabasini Rural Municipality',
    'Dhobini Rural Municipality',
    'Chhipaharmai Rural Municipality',
    'Jagarnathpur Rural Municipality',
    'Jirabhawani Rural Municipality',
    'Kalikamai Rural Municipality',
    'Pakahamainpur Rural Municipality',
    'Pattarghatta Rural Municipality',
    'Sakhuwa Prasauni Rural Municipality',
    'Thori Rural Municipality',
  ],

  // Bagmati Province (13 Districts)
  Kathmandu: [
    'Kathmandu Metropolitan City',
    'Budhanilkantha Municipality',
    'Chandragiri Municipality',
    'Dakshinkali Municipality',
    'Gokarneshwor Municipality',
    'Kageshwori Manohara Municipality',
    'Kirtipur Municipality',
    'Nagarjun Municipality',
    'Shankharapur Municipality',
    'Tarakeshwor Municipality',
    'Tokha Municipality',
  ],
  Bhaktapur: [
    'Bhaktapur Municipality',
    'Changunarayan Municipality',
    'Madhyapur Thimi Municipality',
    'Suryabinayak Municipality',
  ],
  Lalitpur: [
    'Lalitpur Metropolitan City',
    'Godawari Municipality',
    'Mahalaxmi Municipality',
    'Bagmati Rural Municipality',
    'Konjyosom Rural Municipality',
    'Mahankal Rural Municipality',
  ],
  Kavrepalanchok: [
    'Dhulikhel Municipality',
    'Banepa Municipality',
    'Panauti Municipality',
    'Panchkhal Municipality',
    'Namobuddha Municipality',
    'Mandandeupur Municipality',
    'Khanikhola Rural Municipality',
    'Chaurideurali Rural Municipality',
    'Temal Rural Municipality',
    'Bethanchowk Rural Municipality',
    'Bholung Rural Municipality',
    'Roshi Rural Municipality',
    'Mahabharat Rural Municipality',
  ],
  Chitwan: [
    'Bharatpur Metropolitan City',
    'Ratnanagar Municipality',
    'Khairahani Municipality',
    'Rapti Municipality',
    'Kalika Municipality',
    'Madi Municipality',
    'Ichchhakamana Rural Municipality',
  ],
  Makwanpur: [
    'Hetauda Sub-Metropolitan City',
    'Thaha Municipality',
    'Bhimphedi Rural Municipality',
    'Makawanpurgadhi Rural Municipality',
    'Manahari Rural Municipality',
    'Raksirang Rural Municipality',
    'Bakaiya Rural Municipality',
    'Bagmati Rural Municipality',
    'Kailash Rural Municipality',
    'Indrasarowar Rural Municipality',
  ],
  Dhading: [
    'Dhunibesi Municipality',
    'Nilkantha Municipality',
    'Benighat Rorang Rural Municipality',
    'Galchhi Rural Municipality',
    'Gajuri Rural Municipality',
    'Jwalamukhi Rural Municipality',
    'Tripura Sundari Rural Municipality',
    'Gangajamuna Rural Municipality',
    'Netrawati Dabjong Rural Municipality',
    'Thakre Rural Municipality',
    'Ruby Valley Rural Municipality',
    'Siddhalek Rural Municipality',
    'Khaniyabas Rural Municipality',
  ],
  Nuwakot: [
    'Bidur Municipality',
    'Belkotgadhi Municipality',
    'Kakani Rural Municipality',
    'Suryagadhi Rural Municipality',
    'Shivapuri Rural Municipality',
    'Likhu Rural Municipality',
    'Tadi Rural Municipality',
    'Dupcheshwar Rural Municipality',
    'Kispang Rural Municipality',
    'Meghang Rural Municipality',
    'Panchakanya Rural Municipality',
    'Tarkeshwar Rural Municipality',
  ],
  Rasuwa: [
    'Uttargaya Rural Municipality',
    'Kalika Rural Municipality',
    'Gosaikunda Rural Municipality',
    'Naukunda Rural Municipality',
    'Aamachhodingmo Rural Municipality',
  ],
  Sindhupalchok: [
    'Chautara Sangachokgadhi Municipality',
    'Barhabise Municipality',
    'Melamchi Municipality',
    'Balephi Rural Municipality',
    'Sunkoshi Rural Municipality',
    'Indrawati Rural Municipality',
    'Jugal Rural Municipality',
    'Panchpokhari Thangpal Rural Municipality',
    'Bhotekoshi Rural Municipality',
    'Helambu Rural Municipality',
    'Lisankhu Pakhar Rural Municipality',
    'Tripurasundari Rural Municipality',
  ],
  Dolakha: [
    'Bhimeshwor Municipality',
    'Jiri Municipality',
    'Kalinchok Rural Municipality',
    'Melung Rural Municipality',
    'Shailung Rural Municipality',
    'Bigu Rural Municipality',
    'Gaurishankar Rural Municipality',
    'Baiteshwor Rural Municipality',
    'Tamakoshi Rural Municipality',
  ],
  Ramechhap: [
    'Manthali Municipality',
    'Ramechhap Municipality',
    'Umakunda Rural Municipality',
    'Khandadevi Rural Municipality',
    'Gokulganga Rural Municipality',
    'Doramba Rural Municipality',
    'Likhu Tamakoshi Rural Municipality',
    'Sunapati Rural Municipality',
  ],
  Sindhuli: [
    'Kamalamai Municipality',
    'Dudhauli Municipality',
    'Golanjor Rural Municipality',
    'Hariharpurgadhi Rural Municipality',
    'Marin Rural Municipality',
    'Tinpatan Rural Municipality',
    'Ghyanglekh Rural Municipality',
    'Sunkoshi Rural Municipality',
    'Phikkal Rural Municipality',
  ],

  // Gandaki Province (11 Districts)
  Kaski: [
    'Pokhara Metropolitan City',
    'Annapurna Rural Municipality',
    'Machhapuchhre Rural Municipality',
    'Madi Rural Municipality',
    'Rupa Rural Municipality',
  ],
  Tanahun: [
    'Byas Municipality',
    'Bhanu Municipality',
    'Shuklagandaki Municipality',
    'Bhimad Municipality',
    'Anbukhaireni Rural Municipality',
    'Bandipur Rural Municipality',
    'Devghat Rural Municipality',
    'Myagde Rural Municipality',
    'Rishing Rural Municipality',
    'Ghiring Rural Municipality',
  ],
  Gorkha: [
    'Gorkha Municipality',
    'Palungtar Municipality',
    'Barpak Sulikot Rural Municipality',
    'Siranchok Rural Municipality',
    'Ajirkot Rural Municipality',
    'Dharche Rural Municipality',
    'Gandaki Rural Municipality',
    'Bhimsen Thapa Rural Municipality',
    'Shahid Lakhan Rural Municipality',
    'Aarughat Rural Municipality',
    'Chumanuwri Rural Municipality',
  ],
  Lamjung: [
    'Besisahar Municipality',
    'Sundarbazar Municipality',
    'Rainas Municipality',
    'Madhyanepal Municipality',
    'Dordi Rural Municipality',
    'Dudhpokhari Rural Municipality',
    'Marsyangdi Rural Municipality',
    'Kwholasothar Rural Municipality',
  ],
  Syangja: [
    'Putalibazar Municipality',
    'Waling Municipality',
    'Galyang Municipality',
    'Chapakot Municipality',
    'Bhirkot Municipality',
    'Andhikhola Rural Municipality',
    'Phedikhola Rural Municipality',
    'Biruwa Rural Municipality',
    'Harinas Rural Municipality',
    'Kaligandaki Rural Municipality',
    'Arjun Chaupari Rural Municipality',
  ],
  Baglung: [
    'Baglung Municipality',
    'Galkot Municipality',
    'Jaimini Municipality',
    'Dhorpatan Municipality',
    'Bareng Rural Municipality',
    'Badigad Rural Municipality',
    'Nisikhola Rural Municipality',
    'Tamankhola Rural Municipality',
    'Tarakhola Rural Municipality',
    'Kathekhola Rural Municipality',
  ],
  Parbat: [
    'Kushma Municipality',
    'Phalebas Municipality',
    'Jaljala Rural Municipality',
    'Paiyun Rural Municipality',
    'Mahashila Rural Municipality',
    'Modi Rural Municipality',
    'Bihadi Rural Municipality',
  ],
  Myagdi: [
    'Beni Municipality',
    'Annapurna Rural Municipality',
    'Dhaulagiri Rural Municipality',
    'Mangala Rural Municipality',
    'Malika Rural Municipality',
    'Raghuganga Rural Municipality',
  ],
  Nawalpur: [
    'Kawasoti Municipality',
    'Gaindakot Municipality',
    'Devchuli Municipality',
    'Madhyabindu Municipality',
    'Baudeekali Rural Municipality',
    'Bulingtar Rural Municipality',
    'Binayi Tribeni Rural Municipality',
    'Hupsekot Rural Municipality',
  ],
  Mustang: [
    'Gharpajhong Rural Municipality',
    'Thasang Rural Municipality',
    'Baragung Muktikshetra Rural Municipality',
    'Lomanthang Rural Municipality',
    'Lo-Ghekar Damodarkunda Rural Municipality',
  ],
  Manang: [
    'Chame Rural Municipality',
    'Nason Rural Municipality',
    'Narpa Bhumi Rural Municipality',
    'Manang Ngisyang Rural Municipality',
  ],

  // Lumbini Province (12 Districts)
  Rupandehi: [
    'Butwal Sub-Metropolitan City',
    'Siddharthanagar Municipality',
    'Tilottama Municipality',
    'Sainamaina Municipality',
    'Devdaha Municipality',
    'Lumbini Sanskritik Municipality',
    'Omsatiya Rural Municipality',
    'Rohini Rural Municipality',
    'Mayadevi Rural Municipality',
    'Siyari Rural Municipality',
    'Gaudahawa Rural Municipality',
    'Sammarimai Rural Municipality',
    'Kotahimai Rural Municipality',
    'Marchawari Rural Municipality',
    'Kanchan Rural Municipality',
    'Suddhodhan Rural Municipality',
  ],
  Kapilvastu: [
    'Kapilvastu Municipality',
    'Banganga Municipality',
    'Buddhabhumi Municipality',
    'Shivaraj Municipality',
    'Krishnanagar Municipality',
    'Maharajgunj Municipality',
    'Mayadevi Rural Municipality',
    'Yasodhara Rural Municipality',
    'Suddhodhan Rural Municipality',
    'Bijayanagar Rural Municipality',
  ],
  Palpa: [
    'Tansen Municipality',
    'Rampur Municipality',
    'Rainadevi Chhahara Rural Municipality',
    'Mathagadhi Rural Municipality',
    'Nisdi Rural Municipality',
    'Bagnaskali Rural Municipality',
    'Rambha Rural Municipality',
    'Purbakhola Rural Municipality',
    'Tinau Rural Municipality',
    'Ribdikot Rural Municipality',
  ],
  Parasi: [
    'Ramgram Municipality',
    'Bardghat Municipality',
    'Sunwal Municipality',
    'Sarawal Rural Municipality',
    'Palhinandan Rural Municipality',
    'Pratapapur Rural Municipality',
    'Susta Rural Municipality',
  ],
  Arghakhanchi: [
    'Sandhikharka Municipality',
    'Shitganga Municipality',
    'Bhumikasthan Municipality',
    'Chhatradev Rural Municipality',
    'Panini Rural Municipality',
    'Malarani Rural Municipality',
  ],
  Gulmi: [
    'Resunga Municipality',
    'Musikot Municipality',
    'Isma Rural Municipality',
    'Kaligandaki Rural Municipality',
    'Gulmidarbar Rural Municipality',
    'Satyawati Rural Municipality',
    'Chandrakot Rural Municipality',
    'Ruru Rural Municipality',
    'Chhatrakot Rural Municipality',
    'Dhurkot Rural Municipality',
    'Madane Rural Municipality',
    'Malika Rural Municipality',
  ],
  Dang: [
    'Ghorahi Sub-Metropolitan City',
    'Tulsipur Sub-Metropolitan City',
    'Lamahi Municipality',
    'Gadhawa Rural Municipality',
    'Rajpur Rural Municipality',
    'Shantinagar Rural Municipality',
    'Sisne Rural Municipality',
    'Rapti Rural Municipality',
    'Babai Rural Municipality',
    'Dangisharan Rural Municipality',
    'Banglachuli Rural Municipality',
  ],
  Banke: [
    'Nepalgunj Sub-Metropolitan City',
    'Kohalpur Municipality',
    'Baijanath Rural Municipality',
    'Khajura Rural Municipality',
    'Janaki Rural Municipality',
    'Duduwa Rural Municipality',
    'Narainapur Rural Municipality',
    'Rapti Sonari Rural Municipality',
  ],
  Bardiya: [
    'Gulariya Municipality',
    'Madhuwan Municipality',
    'Rajapur Municipality',
    'Thakurbaba Municipality',
    'Bansgadhi Municipality',
    'Barbardiya Municipality',
    'Badhaiyatal Rural Municipality',
    'Geruwa Rural Municipality',
  ],
  Pyuthan: [
    'Pyuthan Municipality',
    'Swargadwari Municipality',
    'Gaumukhi Rural Municipality',
    'Mandavi Rural Municipality',
    'Sarumarani Rural Municipality',
    'Mallarani Rural Municipality',
    'Naubahini Rural Municipality',
    'Jhimruk Rural Municipality',
    'Ayirabati Rural Municipality',
  ],
  Rolpa: [
    'Rolpa Municipality',
    'Runtigadhi Rural Municipality',
    'Triveni Rural Municipality',
    'Sunil Smriti Rural Municipality',
    'Lungri Rural Municipality',
    'Gangadev Rural Municipality',
    'Thabang Rural Municipality',
    'Madi Rural Municipality',
    'Paribartan Rural Municipality',
    'Sukidaha Rural Municipality',
  ],
  'Eastern Rukum': [
    'Putha Uttarganga Rural Municipality',
    'Bhume Rural Municipality',
    'Sisne Rural Municipality',
  ],

  // Karnali Province (10 Districts)
  Surkhet: [
    'Birendranagar Municipality',
    'Gurbhakot Municipality',
    'Bheriganga Municipality',
    'Panchapuri Municipality',
    'Lekbeshi Municipality',
    'Chaukune Rural Municipality',
    'Simta Rural Municipality',
    'Chingad Rural Municipality',
    'Barahatal Rural Municipality',
  ],
  Dailekh: [
    'Narayan Municipality',
    'Dullu Municipality',
    'Chamunda Bindrasaini Municipality',
    'Aathbis Municipality',
    'Dungeshwar Rural Municipality',
    'Mahabu Rural Municipality',
    'Naumule Rural Municipality',
    'Bhagawatimai Rural Municipality',
    'Bhairabi Rural Municipality',
    'Gurans Rural Municipality',
    'Thantikandh Rural Municipality',
  ],
  Salyan: [
    'Sharada Municipality',
    'Bangad Kupinde Municipality',
    'Bagchaur Municipality',
    'Kalimati Rural Municipality',
    'Tribeni Rural Municipality',
    'Kapurkot Rural Municipality',
    'Chatreshwari Rural Municipality',
    'Siddha Kumakh Rural Municipality',
    'Kumakh Rural Municipality',
    'Darma Rural Municipality',
  ],
  Jajarkot: [
    'Bheri Municipality',
    'Chhedagad Municipality',
    'Nalgad Municipality',
    'Barekot Rural Municipality',
    'Kuse Rural Municipality',
    'Junichande Rural Municipality',
    'Shivalaya Rural Municipality',
  ],
  Jumla: [
    'Chandannath Municipality',
    'Kankasundari Rural Municipality',
    'Sinja Rural Municipality',
    'Hima Rural Municipality',
    'Tila Rural Municipality',
    'Guthichaur Rural Municipality',
    'Tatopani Rural Municipality',
    'Patrasi Rural Municipality',
  ],
  Kalikot: [
    'Khandachakra Municipality',
    'Raskot Municipality',
    'Tilagukha Municipality',
    'Sanni Tribeni Rural Municipality',
    'Narharinath Rural Municipality',
    'Shubha Kalika Rural Municipality',
    'Mahawai Rural Municipality',
    'Palata Rural Municipality',
    'Pachaljharana Rural Municipality',
  ],
  Dolpa: [
    'Thuli Bheri Municipality',
    'Tripura Sundari Municipality',
    'Dolpo Buddha Rural Municipality',
    'Shey Phoksundo Rural Municipality',
    'Jagadulla Rural Municipality',
    'Mudkechula Rural Municipality',
    'Kaike Rural Municipality',
    'Chharka Tangsong Rural Municipality',
  ],
  Humla: [
    'Simkot Rural Municipality',
    'Namkha Rural Municipality',
    'Kharpunath Rural Municipality',
    'Sarkegad Rural Municipality',
    'Chankheli Rural Municipality',
    'Adanchuli Rural Municipality',
    'Tanjakot Rural Municipality',
  ],
  Mugu: [
    'Chhayanath Rara Municipality',
    'Mugum Karmarong Rural Municipality',
    'Soru Rural Municipality',
    'Khatyad Rural Municipality',
  ],
  'Western Rukum': [
    'Musikot Municipality',
    'Chaurjahari Municipality',
    'Aathbiskot Municipality',
    'Banfikot Rural Municipality',
    'Triveni Rural Municipality',
    'Sanibheri Rural Municipality',
  ],

  // Sudurpashchim Province (9 Districts)
  Kailali: [
    'Dhangadhi Sub-Metropolitan City',
    'Tikapur Municipality',
    'Godawari Municipality',
    'Lamki Chuha Municipality',
    'Bhajani Municipality',
    'Ghodaghodi Municipality',
    'Gauriganga Municipality',
    'Janaki Rural Municipality',
    'Bardgoriya Rural Municipality',
    'Mohanyal Rural Municipality',
    'Kailari Rural Municipality',
    'Joshipur Rural Municipality',
    'Chure Rural Municipality',
  ],
  Kanchanpur: [
    'Bhimdatta Municipality',
    'Bedkot Municipality',
    'Krishnapur Municipality',
    'Punarbas Municipality',
    'Belauri Municipality',
    'Shuklaphanta Municipality',
    'Mahakali (Dodhara Chandani) Municipality',
    'Beldandi Rural Municipality',
    'Laljhadi Rural Municipality',
  ],
  Dadeldhura: [
    'Amargadhi Municipality',
    'Parshuram Municipality',
    'Aalital Rural Municipality',
    'Bhageshwar Rural Municipality',
    'Navadurga Rural Municipality',
    'Ajaymeru Rural Municipality',
    'Ganyapdhura Rural Municipality',
  ],
  Doti: [
    'Dipayal Silgadhi Municipality',
    'Shikhar Municipality',
    'Purbichowki Rural Municipality',
    'Badikedar Rural Municipality',
    'Jorayal Rural Municipality',
    'Sayal Rural Municipality',
    'Aadarsha Rural Municipality',
    'Dr. K.I. Singh Rural Municipality',
    'Bogatan Phudsil Rural Municipality',
  ],
  Achham: [
    'Mangalsen Municipality',
    'Sanfebagar Municipality',
    'Kamalbazar Municipality',
    'Panchadeval Binayak Municipality',
    'Chaurpati Rural Municipality',
    'Mellekh Rural Municipality',
    'Bannigadhi Jayagadh Rural Municipality',
    'Ramaroshan Rural Municipality',
    'Dhakari Rural Municipality',
    'Turmakhand Rural Municipality',
  ],
  Baitadi: [
    'Dasharathchand Municipality',
    'Patan Municipality',
    'Melauli Municipality',
    'Purchaudi Municipality',
    'Sunary Rural Municipality',
    'Sigas Rural Municipality',
    'Shivanath Rural Municipality',
    'Pancheshwar Rural Municipality',
    'Dogadakedar Rural Municipality',
    'Dilasaini Rural Municipality',
  ],
  Bajhang: [
    'Jayaprithvi Municipality',
    'Bungal Municipality',
    'Talkot Rural Municipality',
    'Masta Rural Municipality',
    'Khaptadchhanna Rural Municipality',
    'Thalara Rural Municipality',
    'Bitthadchir Rural Municipality',
    'Surma Rural Municipality',
    'Chhabispathibhera Rural Municipality',
    'Durgathali Rural Municipality',
    'Kedarsyu Rural Municipality',
    'Saipal Rural Municipality',
  ],
  Bajura: [
    'Badimalika Municipality',
    'Tribeni Municipality',
    'Budhiganga Municipality',
    'Budhinanda Municipality',
    'Gaumul Rural Municipality',
    'Jagannath Rural Municipality',
    'Swami Kartik Khapar Rural Municipality',
    'Chhededaha Rural Municipality',
    'Himali Rural Municipality',
  ],
  Darchula: [
    'Khalanga (Mahakali) Municipality',
    'Shailyashikhar Municipality',
    'Malikarjun Rural Municipality',
    'Apihimal Rural Municipality',
    'Duhun Rural Municipality',
    'Naugad Rural Municipality',
    'Marma Rural Municipality',
    'Lekam Rural Municipality',
    'Byas Rural Municipality',
  ],
};

// Standard Ward numbers 1 to 35 for fast selection and filtering
export const STANDARD_WARDS = Array.from({ length: 35 }, (_, i) => String(i + 1));

// Helper Functions
export function getProvinces() {
  return NEPAL_PROVINCES;
}

export function getDistricts(province = '') {
  if (!province) {
    // Return all 77 districts
    return Object.values(NEPAL_DISTRICTS).flat().sort();
  }
  return NEPAL_DISTRICTS[province] || [];
}

export function getProvinceForDistrict(district = '') {
  if (!district) return '';
  return DISTRICT_TO_PROVINCE[district.trim()] || DISTRICT_TO_PROVINCE[district.trim().toLowerCase()] || '';
}

export function getMunicipalities(district = '') {
  if (!district) return [];
  // Direct match
  if (NEPAL_MUNICIPALITIES[district]) {
    return NEPAL_MUNICIPALITIES[district];
  }
  // Case-insensitive match
  const foundKey = Object.keys(NEPAL_MUNICIPALITIES).find(
    (k) => k.toLowerCase() === String(district).trim().toLowerCase()
  );
  return foundKey ? NEPAL_MUNICIPALITIES[foundKey] : [];
}

export function getWards() {
  return STANDARD_WARDS;
}

export function formatNepalAddress({ province, district, municipality, ward, tole }) {
  const parts = [];
  if (tole && tole.trim()) parts.push(tole.trim());
  if (ward && String(ward).trim()) parts.push(`Ward-${String(ward).trim()}`);
  if (municipality && municipality.trim()) parts.push(municipality.trim());
  if (district && district.trim()) parts.push(district.trim());
  if (province && province.trim()) parts.push(province.trim());
  return parts.join(', ');
}

// Parse a single address string into structured parts if possible
export function parseNepalAddress(str = '') {
  if (!str || typeof str !== 'string') {
    return { province: '', district: '', municipality: '', ward: '', tole: '' };
  }
  const parts = str.split(',').map((s) => s.trim()).filter(Boolean);
  let province = '';
  let district = '';
  let municipality = '';
  let ward = '';
  let tole = '';

  // Look for province at the end
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    const matchedProv = NEPAL_PROVINCES.find((prov) => prov.toLowerCase() === p.toLowerCase());
    if (matchedProv) {
      province = matchedProv;
      parts.splice(i, 1);
      break;
    }
  }

  // Look for district
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    const prov = DISTRICT_TO_PROVINCE[p] || DISTRICT_TO_PROVINCE[p.toLowerCase()];
    if (prov) {
      district = p;
      if (!province) province = prov;
      parts.splice(i, 1);
      break;
    }
  }

  // Look for ward
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    const wardMatch = p.match(/(?:ward\s*[-#]?\s*|w-?)(\d+)/i) || (p.match(/^\d+$/) && parseInt(p, 10) <= 35 ? [, p] : null);
    if (wardMatch) {
      ward = wardMatch[1];
      parts.splice(i, 1);
      break;
    }
  }

  // Remaining parts: municipality and tole
  if (parts.length >= 2) {
    municipality = parts.pop();
    tole = parts.join(', ');
  } else if (parts.length === 1) {
    // If district is known, check if it matches a municipality
    if (district) {
      const munis = getMunicipalities(district);
      const matchedMuni = munis.find((m) => m.toLowerCase().includes(parts[0].toLowerCase()));
      if (matchedMuni) {
        municipality = parts[0];
      } else {
        tole = parts[0];
      }
    } else {
      tole = parts[0];
    }
  }

  return { province, district, municipality, ward, tole };
}

