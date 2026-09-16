/* ============================================================
   stories.js — what is inside each book.

   Every title on the shelves opens to its own story: the people
   and things in it, told in a few short pages. A story is looked up
   by title; a title without one gets pages written from its
   catalogue record. Pictures for the cards go in
   assets/characters/<slug>.jpg and are named in `image`.

   A story may also name a `film`: the slug of a clip in scenes/, made
   from that story's own pictures by tools/bookfilm. The book then gets
   a film page that scrubs as the pages turn.

   LS.Stories.of(bib) -> { story: [..], characters: [{name, role, note, image}], world: [..], why, film }
   ============================================================ */
(function (global) {
  'use strict';

  var LS = global.LS = global.LS || {};

  function C(name, role, note, image) { return { name: name, role: role, note: note, image: image || null }; }

  var STORIES = {
    'The Design of Everyday Things': {
      story: ['A door that needs a sign saying PUSH has already failed. Norman begins with the doors, taps and cookers that defeat clever people every day, and refuses to blame the people.',
              'Good things announce what they do. A handle affords pulling; a flat plate affords pushing; a light or a click tells you it worked.',
              'The book ends where design begins: with the person, standing in front of the thing, trying to get through.'],
      characters: [C('The Norman door', 'The villain', 'A door with a handle on the side you must push. It is everywhere.'),
                   C('The affordance', 'The idea', 'What an object lets you do, and what it looks like it lets you do.'),
                   C('The designer', 'The reader', 'Whoever is responsible the next time someone pulls a push door.')],
      world: ['Affordances and signifiers', 'Feedback', 'Mapping', 'The gulf of execution', 'Human error, or design error'],
      why: 'Every product you have ever sworn at is in here, with its diagnosis.'
    },
    'Sapiens: A Brief History of Humankind': {
      story: ['Seventy thousand years ago an unremarkable ape in East Africa began to tell stories about things that did not exist: spirits, tribes, money. That was the Cognitive Revolution, and it is the whole book.',
              'Wheat domesticated us. Empires, religions and coins let strangers cooperate in their millions. Science, married to capital, rebuilt the world in four centuries.',
              'The last pages ask what we will do once we can redesign ourselves, and whether anyone will be happier.'],
      characters: [C('Homo sapiens', 'The protagonist', 'One of six human species, and the only one left.'),
                   C('Wheat', 'The quiet conqueror', 'A grass that persuaded people to bend over it from dawn to dusk.'),
                   C('The shared fiction', 'The engine', 'Nations, gods and limited companies: real because we agree they are.')],
      world: ['The Cognitive Revolution', 'The Agricultural Revolution', 'The unification of humankind', 'The Scientific Revolution'],
      why: 'A single evening that rearranges everything you learned in school.'
    },
    'Introduction to Algorithms': {
      story: ['Sorting a shelf, finding the shortest way across a city, matching a pattern in a genome: each is a problem, and each has a best-known way of being solved. This is the catalogue of those ways.',
              'Every chapter states a problem, gives an algorithm, proves it correct and counts its cost. The proofs are the point.',
              'It is a reference more than a read. Nobody finishes it; everybody keeps it.'],
      characters: [C('Big O', 'The measure', 'How the cost grows with the size of the problem, ignoring the small print.'),
                   C('The heap', 'The workhorse', 'A tree that always knows its smallest member.'),
                   C('Dijkstra’s algorithm', 'The pathfinder', 'The shortest route from here to everywhere, one edge at a time.')],
      world: ['Divide and conquer', 'Dynamic programming', 'Greedy algorithms', 'Graphs', 'NP-completeness'],
      why: 'The book beside every serious programmer, usually open to the same three chapters.'
    },
    'Things Fall Apart': {
      story: ['Okonkwo is the strongest man in Umuofia, famous for a wrestling match he won as a young man, and terrified of turning out like his father.',
              'He is exiled for seven years for an accident. When he comes home the missionaries have arrived, and his own son is among them.',
              'The Igbo world, with its titles, gods and week of peace, is told from inside. The last paragraph is told by the District Commissioner.'],
      characters: [C('Okonkwo', 'The wrestler', 'A great man whose fear of weakness decides everything he does.'),
                   C('Nwoye', 'The son', 'Gentle where his father is hard, and drawn to the new church’s hymns.'),
                   C('Ikemefuna', 'The boy from Mbaino', 'Given to the village as a peace offering; Okonkwo grows to love him.')],
      world: ['Umuofia', 'The Week of Peace', 'The egwugwu', 'The Evil Forest', 'The church at Mbanta'],
      why: 'The novel that answered Conrad, and started African literature in English on its own terms.'
    },
    'The Argumentative Indian': {
      story: ['Long before the modern republic, India argued. Emperor Ashoka held councils; Akbar debated with priests of every faith; the Upanishads are full of people disagreeing with each other.',
              'Sen follows that habit of public reasoning through history, religion, gender and the bomb, and asks what it means for a democracy.',
              'The essays are calm, learned and quietly furious about the people who would rather India had only one voice.'],
      characters: [C('Ashoka', 'The emperor', 'Who carved rules for civil argument into rock in the third century BCE.'),
                   C('Akbar', 'The listener', 'Who built a hall to hear Hindus, Jains, Parsis, Jews and Jesuits dispute.'),
                   C('Amartya Sen', 'The author', 'An economist who thinks the argument is the point.')],
      world: ['Heterodoxy', 'Public reasoning', 'The Bhagavad Gita, read both ways', 'Secularism', 'The bomb'],
      why: 'An argument for arguing, from someone who has won a Nobel doing it.'
    },
    'Midnight’s Children': {
      story: ['At the stroke of midnight on 15 August 1947, as India becomes free, Saleem Sinai is born, and finds himself handcuffed to history.',
              'A thousand and one children are born in that hour, each with a gift. Saleem can hear them all. Shiva, born beside him and swapped at birth, has knees that can kill.',
              'The novel is a family saga, a comic epic and a country’s first thirty years, told by a man who is literally cracking apart.'],
      characters: [C('Saleem Sinai', 'The narrator', 'Born at midnight, with a nose that can smell feelings and a head full of voices.'),
                   C('Shiva', 'The rival', 'The other midnight child, raised poor in Saleem’s place, born to war.'),
                   C('Padma', 'The listener', 'Who stirs the pickles, doubts every word, and keeps the story honest.')],
      world: ['Bombay', 'The Midnight Children’s Conference', 'The Sundarbans', 'The Emergency', 'Chutney'],
      why: 'The Booker of Bookers. Read it for the sentences, then again for the country.'
    },
    'Clean Code: A Handbook of Agile Software Craftsmanship': {
      story: ['Code is read far more often than it is written. Martin starts from that fact and works outward: names that say what they mean, functions that do one thing, comments that are not lies.',
              'The middle of the book takes real, messy programs and cleans them in front of you, one small step at a time.',
              'The last chapter is a list of smells: everything that should make a reader stop and frown.'],
      characters: [C('The small function', 'The hero', 'Does one thing, does it well, and does only that.'),
                   C('The good name', 'The signpost', 'Reveals intent, needs no comment, and can be pronounced.'),
                   C('The Boy Scout Rule', 'The habit', 'Leave the campground cleaner than you found it.')],
      world: ['Meaningful names', 'Functions', 'Comments', 'Error handling', 'Unit tests', 'Smells and heuristics'],
      why: 'The book teams hand to new hires, and argue about for years.'
    },
    'The Namesake': {
      story: ['A boy is born in Cambridge, Massachusetts, to Bengali parents, and the letter with his good name never arrives from Calcutta. So he is Gogol, after the Russian writer whose book once saved his father’s life.',
              'He grows up hating the name, changes it, falls in and out of love, and understands the story behind it only when his father is gone.',
              'Lahiri writes two generations, two countries and one family in prose so plain it disappears.'],
      characters: [C('Gogol Ganguli', 'The namesake', 'Named for a train wreck and a short story, and slow to forgive either.'),
                   C('Ashoke Ganguli', 'The father', 'Who was reading Gogol when the train left the rails.'),
                   C('Ashima', 'The mother', 'Who learns Boston winters and stays, without ever quite arriving.')],
      world: ['Calcutta', 'Cambridge', 'The overcoat', 'The train', 'Pet names and good names'],
      why: 'The immigrant novel that is really about a name, and everything a name carries.'
    },
    'A Brief History of Time': {
      story: ['Hawking sets out to explain the universe, from the big bang to black holes, using exactly one equation.',
              'Time has a shape. Space is curved. Black holes are not black. If the universe has no edge in time, it needs no beginning and no creator to start it.',
              'The last line asks why the universe bothers to exist at all, and calls that the ultimate triumph of human reason.'],
      characters: [C('The black hole', 'The main character', 'A star that fell into itself, and glows, very faintly, at its edge.'),
                   C('The arrow of time', 'The mystery', 'Why we remember the past and not the future.'),
                   C('E = mc²', 'The only equation', 'Included because the publisher said each one would halve the sales.')],
      world: ['The big bang', 'Uncertainty', 'Event horizons', 'Wormholes', 'The unification of physics'],
      why: 'Ten million copies, most of them unfinished, all of them worth starting.'
    },
    'Train to Pakistan': {
      story: ['Mano Majra is a village on the border where Sikhs and Muslims have shared a well for as long as anyone remembers. In the summer of 1947 that is about to stop.',
              'A train arrives, silent, from Pakistan. What is on it changes the village in an afternoon.',
              'Juggut Singh, the village bad character, in love with a Muslim girl, does the only heroic thing in the book, and nobody sees it.'],
      characters: [C('Juggut Singh', 'The bad character', 'A dacoit by reputation, who ends up on the bridge with a knife and a rope.'),
                   C('Nooran', 'The weaver’s daughter', 'Muslim, pregnant, and on the train that must not be stopped.'),
                   C('Iqbal', 'The visitor', 'A social worker from the city, full of ideas, who does nothing.')],
      world: ['Mano Majra', 'The railway bridge', 'The ghost train', 'The monsoon', 'Partition'],
      why: 'The Partition novel: short, plain and unforgettable.'
    },
    'Thinking, Fast and Slow': {
      story: ['You have two minds. System 1 is fast, automatic and confident; it reads faces and finishes sentences. System 2 is slow, effortful and lazy; it does the sums when forced to.',
              'System 1 is wonderful and frequently wrong, in ways that can be measured: anchors, availability, the halo, the substitution of an easy question for a hard one.',
              'Kahneman and his late partner Amos Tversky spent a career catching it out, and won a Nobel for economics doing it.'],
      characters: [C('System 1', 'The fast one', 'Jumps to conclusions, and is usually right, which is the problem.'),
                   C('System 2', 'The slow one', 'Checks the work, when it can be bothered.'),
                   C('Amos Tversky', 'The partner', 'The other half of every experiment, and of the book’s heart.')],
      world: ['Heuristics and biases', 'Anchoring', 'Loss aversion', 'Prospect theory', 'The experiencing self'],
      why: 'You will never trust your first answer again, which is the idea.'
    },
    'The God of Small Things': {
      story: ['In Ayemenem, in Kerala, twins Rahel and Estha are seven the year their cousin Sophie Mol comes from England and drowns in the river.',
              'Their mother Ammu loves Velutha, an Untouchable carpenter. The Love Laws, which lay down who should be loved, and how, and how much, are broken, and the small things decide everything.',
              'The book circles the one terrible afternoon for three hundred pages, and lands on it at the end.'],
      characters: [C('Rahel and Estha', 'The twins', 'Two-egg twins who think of themselves as Me, and separately as We.'),
                   C('Velutha', 'The god of small things', 'The carpenter who can fix anything, and whom the family cannot forgive for being loved.'),
                   C('Ammu', 'The mother', 'Divorced, unwelcome in her own house, and briefly, dangerously happy.')],
      world: ['Ayemenem', 'The History House', 'Paradise Pickles & Preserves', 'The river', 'The Love Laws'],
      why: 'A first novel that won the Booker, for sentences nobody else could have written.'
    },
    'Principles of Economics': {
      story: ['People face trade-offs. The cost of something is what you give up to get it. Rational people think at the margin. Mankiw opens with ten principles and spends the rest of the book earning them.',
              'Supply meets demand, markets usually work, governments sometimes help, and the whole economy adds up to the sum of everyone’s choices.',
              'It is the first-year textbook of half the world, and it reads like one: patient, tidy and full of examples about coffee.'],
      characters: [C('The rational consumer', 'The model citizen', 'Who weighs every marginal cup of coffee against the alternative.'),
                   C('The invisible hand', 'The idea', 'Adam Smith’s: self-interest, in a market, adding up to something good.'),
                   C('The trade-off', 'The first principle', 'Nothing is free, not even lunch.')],
      world: ['Supply and demand', 'Elasticity', 'Externalities', 'The firm', 'Inflation and unemployment'],
      why: 'If you read one economics book, it is probably this one, whether you chose it or not.'
    },
    'Gray’s Anatomy for Students': {
      story: ['The body, region by region: back, thorax, abdomen, pelvis, limbs, head and neck. Each system is drawn, labelled and given its clinical meaning.',
              'The illustrations are the book. The text tells you what a surgeon would want you to know before you cut.',
              'It descends from the Gray of 1858, drawn by Henry Vandyke Carter, who never got his name on the cover.'],
      characters: [C('The heart', 'The engine', 'Four chambers, two circuits, and a rhythm that starts before birth.'),
                   C('The brachial plexus', 'The puzzle', 'Five roots, three trunks, six divisions, three cords, five branches. Every student draws it.'),
                   C('Henry Vandyke Carter', 'The illustrator', 'Who drew the first Gray’s and was left off the title page.')],
      world: ['Regional anatomy', 'Surface anatomy', 'Imaging', 'Clinical cases', 'The dissection room'],
      why: 'The atlas every medical student carries, and every doctor still opens.'
    },
    'The Discovery of India': {
      story: ['Written in Ahmednagar Fort prison between 1942 and 1944, by a man who would be Prime Minister in three years, this is a country reading its own past.',
              'Nehru walks from the Indus Valley through the Vedas, the Mauryas, the Guptas, the Mughals and the British, looking for the thread that holds India together.',
              'It is a history and a love letter, and a manifesto for the state he was about to build.'],
      characters: [C('Jawaharlal Nehru', 'The prisoner', 'Writing with no library, from memory and conviction.'),
                   C('Bharat Mata', 'The idea', 'A country as one thing, over five thousand years.'),
                   C('Ahmednagar Fort', 'The place', 'Where the book, and the Cabinet that would run India, were both made.')],
      world: ['The Indus Valley', 'The Upanishads', 'Ashoka', 'The synthesis', 'Freedom'],
      why: 'The founder’s view of the country, written before the country existed.'
    },
    'Norwegian Wood': {
      story: ['A song plays on a plane and Toru Watanabe, thirty-seven, is back in Tokyo in 1969, walking through a meadow with Naoko.',
              'Naoko was his dead best friend’s girl. Midori is alive, direct and funny, and asks him to think about her when he thinks about anything.',
              'It is Murakami’s one plain novel: no cats that talk, no second moon, just grief, sex and the Beatles.'],
      characters: [C('Toru Watanabe', 'The narrator', 'Who reads The Great Gatsby and cannot choose.'),
                   C('Naoko', 'The one who left', 'Beautiful, fragile, and in a sanatorium in the hills above Kyoto.'),
                   C('Midori Kobayashi', 'The one who stayed', 'Who wants to be spoiled, once, by someone who means it.')],
      world: ['Tokyo, 1969', 'The Ami Hostel', 'The meadow', 'The well', 'The song'],
      why: 'The book that made Murakami famous in Japan, and the one he almost regrets.'
    },
    'Law of Contract and Specific Relief': {
      story: ['An offer, an acceptance, a consideration: the Indian Contract Act of 1872 says when a promise becomes something a court will enforce.',
              'Avtar Singh walks every section with the cases that decided what it means, from the tea shop to the Supreme Court.',
              'The Specific Relief Act follows: when money is not enough, and the court orders the thing itself to be done.'],
      characters: [C('The offer', 'Section 2(a)', 'A promise, made to be accepted.'),
                   C('Consideration', 'Section 2(d)', 'Something for something; the price of a promise.'),
                   C('Specific performance', 'The remedy', 'Do what you said, says the court, because damages will not do.')],
      world: ['Offer and acceptance', 'Free consent', 'Void agreements', 'Breach and damages', 'Injunctions'],
      why: 'The commentary every Indian law student is told to buy, and every practitioner keeps.'
    },
    'Educated: A Memoir': {
      story: ['Tara Westover is born to survivalist Mormons in the mountains of Idaho, has no birth certificate, and never sees a classroom until she is seventeen.',
              'She teaches herself enough to pass a test, gets into Brigham Young, then Cambridge, then Harvard, and learns, with each step, how much of her childhood was not true.',
              'The education is not the degrees. It is deciding which family stories to believe.'],
      characters: [C('Tara', 'The narrator', 'Who works the junkyard, sings in the choir, and reads her way out.'),
                   C('Gene', 'The father', 'Preparing for the End of Days, and mistrustful of doctors, schools and the government.'),
                   C('Shawn', 'The brother', 'Whose violence the family agrees not to have seen.')],
      world: ['Buck’s Peak', 'The junkyard', 'The Y2K pantry', 'Cambridge', 'The last phone call'],
      why: 'A memoir of learning that is really about the price of a self.'
    },
    'The Wonder That Was India': {
      story: ['Basham surveys the sub-continent from the Indus cities to the eve of the Muslim conquests: its kings, castes, sciences, gods and daily life.',
              'The chapters are on the state, society, everyday life, religion, art and language, and each is a small book of its own.',
              'It was written in 1954 and it shows, in places, but nobody has replaced it as the one volume to begin with.'],
      characters: [C('Chandragupta Maurya', 'The founder', 'Who took an empire from the Nandas with Kautilya at his elbow.'),
                   C('Kalidasa', 'The poet', 'Whose cloud carried a message across India in a hundred verses.'),
                   C('Aryabhata', 'The astronomer', 'Who put the earth on its axis and gave zero a place to sit.')],
      world: ['Mohenjo-daro', 'The Mauryas and Guptas', 'Dharma and caste', 'Sanskrit', 'Temples and stupas'],
      why: 'Still the classic introduction to classical India, sixty years on.'
    },
    'Blade Runner 2049': {
      story: ['Thirty years after Deckard, a replicant blade runner called K retires an old model on a protein farm and finds a box of bones under a dead tree.',
              'The bones belonged to a replicant who gave birth. K is sent to find the child, and starts to wonder whether he is it.',
              'The film is slow, enormous and quiet. Deckard is living in an empty casino in Las Vegas with a dog.'],
      characters: [C('K', 'The blade runner', 'A Nexus-9 who does his job, goes home to a hologram, and has a wooden horse.'),
                   C('Joi', 'The hologram', 'Everything he wants, and sold by the million.'),
                   C('Rick Deckard', 'The old blade runner', 'Found in the dust, and still not saying what he is.')],
      world: ['Los Angeles, 2049', 'The Wallace Corporation', 'The orphanage at San Diego', 'Las Vegas', 'The snow'],
      why: 'A sequel that earns its length, and its silence.'
    },
    'Loan Laptop — ThinkPad T14 (4-hour)': {
      story: ['A laptop for four hours, inside the building. Bring your card to the desk; leave the desk with a machine, its charger and a sleeve.',
              'It comes back wiped. Save your work somewhere else before the four hours are up.'],
      characters: [C('The ThinkPad', 'The equipment', 'A T14 with a fresh image, waiting behind the desk.'),
                   C('The charger', 'The companion', 'In the sleeve. Please return it in the sleeve.'),
                   C('You', 'The borrower', 'Four hours, then the desk again.')],
      world: ['Short loan', 'In-building use', 'Wiped on return', 'Charger and sleeve'],
      why: 'When your own battery has given up.'
    },
    'Alice’s Adventures in Wonderland': {
      story: ['Alice is bored on a riverbank when a White Rabbit runs past looking at its watch. She follows it down the hole, and falls for a very long time.',
              'She grows, shrinks, swims in her own tears, plays croquet with flamingos and takes tea with a Hatter for whom it is always six o’clock.',
              'At the trial of the Knave of Hearts the Queen shouts for heads, the cards fly up, and Alice wakes on the bank.'],
      characters: [C('Alice', 'The girl', 'Seven and a half exactly, sensible, and forever the wrong size.'),
                   C('The White Rabbit', 'The guide', 'Late, waistcoated, and very worried about the Duchess.'),
                   C('The Cheshire Cat', 'The philosopher', 'Who vanishes slowly, leaving the grin last.')],
      world: ['The rabbit hole', 'The pool of tears', 'The Caterpillar’s mushroom', 'The mad tea party', 'The Queen’s croquet ground'],
      why: 'The children’s book adults keep, because it argues back.'
    },
    'The Jungle Book': {
      story: ['A man-cub crawls into a wolf den in the Seeonee hills and is raised by the pack, with Baloo the bear to teach him the Law and Bagheera the panther to keep him alive.',
              'Shere Khan the tiger wants him. Kaa the python helps, in his way. The monkeys carry him off to the Cold Lairs.',
              'Mowgli grows up between the jungle and the village and belongs to neither; the last story sends him, finally, to men.'],
      characters: [C('Mowgli', 'The man-cub', 'Frog, the wolves called him: hairless, and afraid of nothing.'),
                   C('Baloo', 'The teacher', 'The sleepy brown bear who teaches the Law of the Jungle.'),
                   C('Shere Khan', 'The tiger', 'Lame from birth, and certain the man-cub is his by right.')],
      world: ['The Seeonee hills', 'The Council Rock', 'The Cold Lairs', 'The Law of the Jungle', 'The Red Flower'],
      why: 'Wolves, a bear, a panther and a boy: the jungle as a school.'
    },
    'The Blue Umbrella': {
      story: ['Binya, ten, lives in a village in the Garhwal hills. She trades her lucky leopard-claw pendant to some picnickers for a blue silk umbrella, the most beautiful thing anyone there has seen.',
              'Ram Bharosa, the shopkeeper, wants it badly enough to do something foolish. The village turns on him.',
              'How Binya ends the story is the whole point of it, and it takes her about a minute.'],
      characters: [C('Binya', 'The girl', 'Who owns a blue umbrella and knows exactly what it is worth.'),
                   C('Ram Bharosa', 'The shopkeeper', 'Who sells tea and biscuits, and cannot stop looking at the umbrella.'),
                   C('The blue umbrella', 'The thing itself', 'Blue silk, from the plains, opened on a hillside.')],
      world: ['The Garhwal hills', 'The tea shop', 'The leopard claw', 'The bear', 'The monsoon'],
      why: 'A small perfect story, ninety pages long, about generosity.'
    },
    'Treasure Island': {
      story: ['An old sailor dies at the Admiral Benbow inn and leaves a map. Jim Hawkins, the landlord’s son, sails with it to an island, in a ship whose cook has one leg and a parrot.',
              'In the apple barrel Jim hears the crew plan their mutiny. The rest is stockades, marooned men, the black spot and a lot of rum.',
              'Long John Silver is the best villain in English fiction because he is also, when it suits him, the best friend.'],
      characters: [C('Jim Hawkins', 'The boy', 'Who should not have been listening, and hears everything.'),
                   C('Long John Silver', 'The cook', 'One leg, a crutch, a parrot called Captain Flint, and a plan.'),
                   C('Ben Gunn', 'The marooned man', 'Three years alone on the island, and dreaming of cheese.')],
      world: ['The Admiral Benbow', 'The Hispaniola', 'The apple barrel', 'The stockade', 'Spy-glass Hill'],
      why: 'The pirate story every other pirate story is copying.'
    },
    'Twenty Thousand Leagues Under the Seas': {
      story: ['Professor Aronnax, his servant Conseil and the harpooner Ned Land go hunting a sea monster and are taken aboard it. It is a submarine, the Nautilus, and its captain will never let them go.',
              'They see the drowned city of Atlantis, walk the sea floor, fight a giant squid and pass under the ice at the South Pole.',
              'Captain Nemo has fled the world of nations. Where the Nautilus goes when the book ends, nobody knows.'],
      characters: [C('Captain Nemo', 'The captain', 'No one, in Latin. An engineer, an exile, and at war with someone he will not name.'),
                   C('Pierre Aronnax', 'The professor', 'Who came to classify a monster and stayed to describe a world.'),
                   C('Ned Land', 'The harpooner', 'Canadian, impatient, and the only one who wants to leave.')],
      world: ['The Nautilus', 'The forests of Crespo', 'Atlantis', 'The South Pole', 'The Maelstrom'],
      why: 'A submarine, invented on paper in 1870, that the real ones were named after.'
    },
    'Moby-Dick; or, The Whale': {
      film: 'story-moby-dick',
      story: ['Call me Ishmael. A schoolteacher signs on a Nantucket whaler, the Pequod, and shares a bed at the inn with a tattooed harpooner called Queequeg.',
              'The captain, Ahab, has one leg and one purpose: the white whale that took the other. He nails a gold doubloon to the mast for the man who sights it.',
              'Between the chase there is everything: the anatomy of whales, the colour white, the cook’s sermon to sharks. The whale wins.'],
      characters: [C('The white whale', 'The whale', 'Scarred, enormous, and older than the grudge against it.', 'assets/characters/white-whale.jpg'),
                   C('Captain Ahab', 'The captain', 'Grand, ungodly, god-like: a man with a whalebone leg and a grudge.'),
                   C('Ishmael', 'The survivor', 'Who tells it, because only he was left to.'),
                   C('Queequeg', 'The harpooner', 'A prince from an island not on any map, whose coffin becomes the lifebuoy.')],
      world: ['The Pequod', 'Nantucket', 'The doubloon', 'The try-works', 'The white whale'],
      why: 'The great American novel, about a fish. Read the chase chapters first if you must.'
    },
    'The Histories': {
      story: ['Herodotus of Halicarnassus sets down his inquiry so that the deeds of Greeks and barbarians will not be forgotten, and above all why they fought.',
              'On the way there are gold-digging ants, Egyptian embalmers, Croesus and his misread oracle, and the wife of Candaules.',
              'Then Marathon, Thermopylae and Salamis: three hundred Spartans, a wooden wall, and the largest army the world had seen, turned back.'],
      characters: [C('Herodotus', 'The inquirer', 'The father of history, and, said Plutarch, of lies. He says what he was told.'),
                   C('Xerxes', 'The Great King', 'Who whipped the Hellespont for breaking his bridge.'),
                   C('Leonidas', 'The king of Sparta', 'Who held the pass with three hundred, and knew how it would end.')],
      world: ['Lydia and Croesus', 'Egypt', 'Marathon', 'Thermopylae', 'Salamis'],
      why: 'The first history, and still the best-told.'
    },
    'The Arthashastra': {
      story: ['How to run a kingdom, by the man who helped Chandragupta take one: taxes, spies, ministers, forts, war and the price of grain.',
              'The king should sleep little, trust less, and know what his ministers are doing before they do it. Every chapter is practical and some are chilling.',
              'Lost for centuries, it was found on palm leaves in 1905 and changed what the world thought ancient India was.'],
      characters: [C('Kautilya', 'The author', 'Also Chanakya, also Vishnugupta: the minister behind the first Indian empire.'),
                   C('The king', 'The student', 'Whose day is divided into ninety-minute parts, each with its duty.'),
                   C('The spy', 'The instrument', 'A monk, a merchant, a widow, a poisoner: the state has eyes.')],
      world: ['The seven limbs of the state', 'Espionage', 'The treasury', 'The circle of kings', 'War'],
      why: 'Machiavelli, eighteen centuries earlier and more thorough.'
    },
    'The Epic of Gilgamesh': {
      story: ['Gilgamesh, king of Uruk, two-thirds god, is too strong for his city. The gods make Enkidu, a wild man, to match him. They fight, and become friends.',
              'Together they kill Humbaba in the cedar forest and the Bull of Heaven. For that, Enkidu must die. Gilgamesh, grieving, goes looking for a way not to.',
              'He finds Utnapishtim, who survived the flood, and a plant of youth, and loses it to a snake. He goes home, and looks at the walls of Uruk.'],
      characters: [C('Gilgamesh', 'The king', 'Who wanted to live forever and settled for a wall.'),
                   C('Enkidu', 'The wild man', 'Made of clay, raised by animals, tamed by a woman, and the king’s only friend.'),
                   C('Utnapishtim', 'The far-away', 'The one man the gods let live forever, after the flood.')],
      world: ['Uruk', 'The cedar forest', 'The Bull of Heaven', 'The waters of death', 'The plant of youth'],
      why: 'The oldest story we have, and it is about grief.'
    },
    'The Odyssey': {
      film: 'story-odyssey',
      story: ['Troy has fallen. Odysseus wants to go home to Ithaca, and it takes him ten years: the Cyclops, the Lotus-eaters, Circe, the Sirens, Scylla, Calypso, and the anger of Poseidon.',
              'At home Penelope weaves and unweaves a shroud to keep a hundred suitors waiting, and their son Telemachus goes looking for news.',
              'He comes back as a beggar, strings the bow no suitor could, and the hall is cleared by nightfall.'],
      characters: [C('Odysseus', 'The man of many turns', 'Who blinded a giant and told him his name was Nobody.', 'assets/characters/odysseus.jpg'),
                   C('Penelope', 'The weaver', 'Who tests even her husband, with a bed that cannot be moved.'),
                   C('Athena', 'The goddess', 'Grey-eyed, in disguise, and on his side.')],
      world: ['Ithaca', 'The Cyclops’ cave', 'The Sirens', 'Calypso’s island', 'The bow'],
      why: 'The journey home, three thousand years old, and still the shape of every one.'
    },
    'The Ramayana: A Shortened Modern Prose Version': {
      film: 'story-ramayana',
      story: ['Rama, prince of Ayodhya, is exiled to the forest for fourteen years on the eve of his coronation. Sita, his wife, and Lakshmana, his brother, go with him.',
              'Ravana, the ten-headed king of Lanka, carries Sita off in his flying chariot. Rama’s search brings him Hanuman, who leaps the sea in one bound and finds her in the ashoka grove.',
              'The monkeys build a bridge, Lanka burns, Ravana falls, and Rama goes home to Ayodhya, where the lamps are still lit for him every year.'],
      characters: [C('Rama', 'The prince', 'The seventh avatar of Vishnu, who keeps every promise, including the ones that cost him everything.', 'assets/characters/rama.jpg'),
                   C('Hanuman', 'The son of the wind', 'Who leaps the ocean, burns Lanka with his tail, and carries a mountain for a herb.', 'assets/characters/hanuman.jpg'),
                   C('Sita', 'The princess', 'Born of the earth, taken to Lanka, and unbroken there.', 'assets/characters/sita.jpg'),
                   C('Ravana', 'The king of Lanka', 'Ten heads, twenty arms, and a boon that protects him from everyone but a man.', 'assets/characters/ravana.jpg')],
      world: ['Ayodhya', 'The forest of Dandaka', 'The golden deer', 'Lanka', 'The bridge of the monkeys', 'Diwali'],
      why: 'Narayan’s telling: one evening long, and the whole epic in it.'
    },
    'Metamorphoses': {
      story: ['From the creation of the world to the deification of Julius Caesar, Ovid tells two hundred and fifty stories in which somebody turns into something else.',
              'Daphne becomes a laurel to escape Apollo. Narcissus becomes a flower. Arachne, who wove better than a goddess, becomes a spider. Midas gets his wish.',
              'It is a single poem, fifteen books long, and every myth you half-remember is in it in its best-known form.'],
      characters: [C('Daphne', 'The laurel', 'Who ran from a god and put down roots.'),
                   C('Arachne', 'The weaver', 'Who beat Minerva at the loom and pays for it in eight legs.'),
                   C('Orpheus', 'The singer', 'Who looked back.')],
      world: ['Chaos', 'Phaethon’s chariot', 'The house of Sleep', 'Pygmalion’s statue', 'The apotheosis of Caesar'],
      why: 'The source book for Shakespeare, Dante, Bernini and every myth you know.'
    },
    'Dracula': {
      story: ['Jonathan Harker travels to Transylvania to sell a house to a count, and finds himself a prisoner in a castle where the host casts no shadow.',
              'A ship runs aground at Whitby with a dead crew and a large dog. Lucy Westenra begins to sicken. Dr Van Helsing arrives from Amsterdam with garlic and a theory.',
              'The book is letters, diaries, telegrams and a phonograph, and the hunt runs from London back to the Carpathians by the last light of a winter day.'],
      characters: [C('Count Dracula', 'The vampire', 'Old, courteous, and never seen to eat.'),
                   C('Mina Harker', 'The typist', 'Who assembles the evidence and is bitten for it.'),
                   C('Abraham Van Helsing', 'The doctor', 'Who believes in both the microscope and the crucifix.')],
      world: ['Castle Dracula', 'The Demeter', 'Whitby', 'Carfax', 'The Borgo Pass'],
      why: 'The vampire novel. Everything after it is a footnote with fangs.'
    },
    'Frankenstein; or, The Modern Prometheus': {
      story: ['Victor Frankenstein, a student at Ingolstadt, discovers how to give life to dead matter, assembles a creature eight feet tall, and runs away the moment it opens its eyes.',
              'The creature teaches itself to speak by watching a family through a chink in a wall, reads Paradise Lost, and asks his maker for one thing: a companion.',
              'Refused, he takes everything Victor loves. The chase ends in the Arctic, on the ice, in a letter.'],
      characters: [C('Victor Frankenstein', 'The maker', 'Who wanted to be a god and could not stand to look at what he made.'),
                   C('The creature', 'The made', 'Unnamed, eloquent, and more human than his maker.'),
                   C('Robert Walton', 'The explorer', 'Whose letters to his sister carry the whole story home.')],
      world: ['Ingolstadt', 'The De Lacey cottage', 'Mont Blanc', 'The Orkneys', 'The polar ice'],
      why: 'Written by a nineteen-year-old, on a dare, in the wet summer of 1816.'
    },
    'The Turn of the Screw': {
      story: ['A young governess takes charge of two children at a country house called Bly, on the condition that she never troubles their uncle about anything.',
              'She begins to see a man on the tower and a woman by the lake. They are, she learns, the dead valet and the dead governess, and they want the children.',
              'Nobody else admits to seeing them. Whether the ghosts are real or the governess is, is the question the book was built to keep open.'],
      characters: [C('The governess', 'The narrator', 'Twenty, clever, in love with her employer, and certain.'),
                   C('Miles', 'The boy', 'Expelled from school for a reason no one will say.'),
                   C('Peter Quint', 'The man on the tower', 'Red-haired, dead, and looking in.')],
      world: ['Bly', 'The tower', 'The lake', 'The schoolroom', 'The last page'],
      why: 'The ghost story that may not be one, and is scarier for it.'
    },
    'Digital Minimalism': {
      story: ['The phone was not designed to be picked up two hundred times a day; it was designed so that you would. Newport begins with the attention economy and how it got into your pocket.',
              'The cure is a thirty-day declutter: remove the optional technologies, rediscover what you actually value, then let back in only what serves it.',
              'The second half is about solitude, conversation and hobbies with your hands: what the time is for.'],
      characters: [C('The digital minimalist', 'The reader', 'Who uses fewer things, more deliberately.'),
                   C('The declutter', 'The method', 'Thirty days without the optional, then a careful return.'),
                   C('Solitude', 'The recovered thing', 'Time alone with your own thoughts, and nothing else’s.')],
      world: ['The attention economy', 'The digital declutter', 'Solitude deprivation', 'Conversation over connection', 'Leisure'],
      why: 'A philosophy, not a detox: the argument for using technology on purpose.'
    },
    'Why We Sleep': {
      story: ['A third of your life, and until recently nobody could say what it was for. Walker lays out what sleep does to memory, mood, the heart, the immune system and the length of a life.',
              'Dreams are overnight therapy. Short sleep is a slow harm. Alarm clocks, screens and late coffee are the villains, and adolescence is not laziness.',
              'The last chapter is twelve tips, and the first one is a regular bedtime.'],
      characters: [C('REM sleep', 'The dreamer', 'The stage where the brain tells itself stories and files the day.'),
                   C('Adenosine', 'The pressure', 'Builds all day, and caffeine only blocks the reading of it.'),
                   C('The alarm clock', 'The enemy', 'A daily small cardiac shock, according to the author.')],
      world: ['Circadian rhythm', 'Sleep pressure', 'Memory consolidation', 'Dreaming', 'The sleep-deprived society'],
      why: 'You will go to bed earlier tonight, which is what the author wanted.'
    },
    'The Anarchy': {
      story: ['In 1599 a group of London merchants formed a company to trade in spices. By 1803 that company had an army twice the size of Britain’s and ruled most of India from an office five windows wide.',
              'Dalrymple tells how it happened: Plassey, Buxar, the loot of Bengal, the famine, the wars with the Marathas and Tipu, and a Parliament that watched.',
              'It is the story of a corporation that became a state, told from Persian and English sources with equal weight.'],
      characters: [C('Robert Clive', 'The company man', 'A clerk who became a general, and richer than the king.'),
                   C('Shah Alam II', 'The emperor', 'A Mughal blinded in his own palace, and kept as a signature.'),
                   C('Tipu Sultan', 'The Tiger of Mysore', 'The last ruler who could have stopped them, and nearly did.')],
      world: ['Leadenhall Street', 'Plassey', 'Bengal', 'Seringapatam', 'The Red Fort'],
      why: 'How a company bought a country, told like a thriller.'
    },
    'Constitutional Law of India': {
      story: ['The Constitution of India is the longest in the world: 395 articles at birth, a Preamble that begins We, the People, and a promise of justice, liberty, equality and fraternity.',
              'This is the standard commentary on it: fundamental rights, the directive principles, the courts, the Union and the States, and the basic structure that Parliament cannot amend away.',
              'Every article comes with the cases that tested it, from Kesavananda Bharati to the ones decided last year.'],
      characters: [C('The Preamble', 'The promise', 'We, the People of India, having solemnly resolved.'),
                   C('Article 21', 'The right', 'Life and personal liberty, read wider every decade.'),
                   C('The basic structure', 'The limit', 'Kesavananda Bharati, 1973: some things cannot be amended.')],
      world: ['Fundamental rights', 'Directive principles', 'The Supreme Court', 'Federalism', 'Amendment'],
      why: 'The one book on the Constitution that every Indian lawyer opens first.'
    }
  };

  /** pages for a title with no story written: told from its record */
  function generic(bib) {
    var subjects = (bib.subjects || []).slice(0, 5);
    return {
      story: [bib.summary || ('A title from the ' + (bib.collection || 'library') + ' shelves.'),
              'Published by ' + (bib.publisher || 'the publisher') + ' in ' + (bib.year || 'its year') + ', and catalogued under ' + (bib.dewey || 'its class') + '.'],
      characters: [C(bib.author || 'The author', 'The author', 'Who wrote it.'),
                   C(bib.title, 'The book', bib.summary || ''),
                   C(subjects[0] || 'The subject', 'The subject', 'What it is about.')],
      world: subjects.length ? subjects : ['On the shelf'],
      why: 'Ask at the desk; someone here has read it.'
    };
  }

  function of(bib) {
    var s = bib && STORIES[bib.title];
    return s || generic(bib || {});
  }

  LS.Stories = { of: of, STORIES: STORIES };
})(window);
