import type { MurderCaseDef, MurderCaseSummary, MurderCharacterDef, MurderPrivateClueDef, MurderPublicClueDef } from '@synccinema/common';

/**
 * Murder Mystery Night: the case catalogue (static content, server only). Only redacted parts ever reach a client.
 *
 * Writing rules: PG-13, no gore, invented people only. For every case the murderer is a fixed character (the PLAYER who gets that
 * character is chosen by the engine with crypto-quality randomness). `required` lists the murderer and the holders of the private
 * clues the solution needs (at most 6, so a 6-player game is always solvable). Public clues of rounds 1-3 never contain the
 * murderer's name (guarded by games-murder-mystery-cases.test.ts).
 */

const ch = (
  id: string,
  name: string,
  bio: string,
  relationship: string,
  secretMotive: string,
  alibi: string,
  alibiTruth: string,
  secret: string
): MurderCharacterDef => ({ id, name, bio, relationship, secretMotive, alibi, alibiTruth, secret });

const pub = (id: string, text: string): MurderPublicClueDef => ({ id, text });
const pri = (id: string, ownerId: string, text: string): MurderPrivateClueDef => ({ id, ownerId, text });

/*
 * CASE 1: Death at the Grand Cinema. Murderer: Meera Iyer (publicist). Required: meera-iyer, hari-prasad, joseph-pereira,
 * kabir-anand, farah-sheikh, nandini-shah.
 * Chain: R1 time window 8:50-9:20, a big dose of heart medicine Vikram never took; the director and both leads were on stage 8:35-8:48.
 * R2 the decanter stood unguarded on the corridor table from 8:35 and there are two ways up (watched grand staircase, unwatched
 * service stair). R3 CCTV: nobody used the grand staircase 8:36-8:48, so the poisoner used the service stair; the tray napkin smells
 * of jasmine attar. Privately: Hari saw who stayed in the foyer (everybody except Meera after 8:36), Joseph and Kabir cover each other
 * in the booth and Joseph glimpsed green glass bangles over the tray, Farah saw Meera leave the service door at 8:46, Nandini knows
 * Meera wears jasmine attar and green bangles. R4: an empty pharmacy bottle behind the coats by the service door plus Nandini's memory
 * of Meera's "father's tablets" from Matunga, and Rajiv knows Vikram was about to fire her.
 */
const GRAND_CINEMA: MurderCaseDef = {
  id: 'grand-cinema',
  title: 'Death at the Grand Cinema',
  tagline: 'A film premiere, a private balcony box and a poisoned drink.',
  blurb:
    'The Grand Cinema in Mumbai is packed for the premiere of Monsoon Letters. At the interval the producer shakes hands in the foyer; by the final credits he is found dead in his private balcony box. Everybody at the premiere is a suspect.',
  victim: {
    name: 'Vikram Sethi',
    bio: 'Film producer and head of Sethi Pictures, known for backing big romances and bigger arguments.',
    causeOfDeath: 'Poisoned.'
  },
  characters: [
    ch('rhea-malhotra', 'Rhea Malhotra', 'Lead actress of Monsoon Letters, adored by the press.', "Vikram's star, tied to him by a four-film contract.",
      'You wanted out of your contract, and Vikram swore he would ruin your career if you walked.',
      'I was on stage for the interval Q&A from 8:35 until 8:48, then in my seat for the second half.',
      'She was on stage for the whole Q&A in front of a full house, then sat beside the director.',
      'You have a script of your own in your bag and hope to pitch it to a rival producer.'),
    ch('dev-khanna', 'Dev Khanna', 'Male lead of the film, a former cricketer turned actor.', "Vikram's leading man and regular sparring partner.",
      'Vikram took your name off the top of the poster, and you swore to make him pay for it.',
      'I was on stage for the Q&A from 8:35, then went back to my seat for the second half.',
      'He was on stage for the whole Q&A and sat in row C afterwards.',
      'You owe a large gambling debt to a bookmaker and have been avoiding his calls.'),
    ch('tara-bose', 'Tara Bose', 'Director of Monsoon Letters, soft-spoken and stubborn.', "Vikram's director, whose final cut he threatened to overrule.",
      'Vikram planned to re-cut your film and give the credit to someone else.',
      'I was on stage for the interval Q&A, then sat in the front row for the rest of the film.',
      'She hosted the Q&A on stage from 8:35 to 8:48 and sat in the front row after it.',
      'The most famous scene in your film is copied shot for shot from an old foreign movie, and you fear being found out.'),
    ch('dr-anjali-rao', 'Dr. Anjali Rao', "Vikram's family doctor and a guest of honour.", "Vikram's physician for twenty years.",
      'Vikram knew you once signed a false medical certificate for his rival and threatened to report you.',
      'I spent the interval at the foyer bar talking with Rajiv Sethi, then returned to my seat in row F.',
      'She stayed in the foyer within the usher\'s sight all interval, then sat in row F.',
      'You are quietly planning to leave medicine to open a restaurant and have sunk your savings into it.'),
    ch('hari-prasad', 'Hari Prasad', 'Head usher of the Grand Cinema, thirty years at his post.', 'A cinema employee who met Vikram only at premieres.',
      'Vikram promised the staff a bonus for the premiere and then cancelled it, costing you a month of extra pay.',
      'I stood at the bottom of the grand staircase for the whole interval, watching the foyer.',
      'True. From his post he could see the whole foyer, the bar and the cloakroom corridor.',
      'You resell leftover tickets outside the cinema to earn a little extra money.'),
    ch('joseph-pereira', 'Joseph Pereira', 'Projectionist of the Grand Cinema, devoted to old film prints.', 'A projectionist who disliked Vikram\'s plan to scrap the cinema\'s film projector.',
      'Vikram ordered your beloved film projector scrapped, which would end your career.',
      'I was in the projection booth with Kabir Anand from 8:35, preparing the second reel.',
      'True. He and Kabir never left the booth. Through the booth window he glimpsed a woman\'s arm at the tray around 8:42.',
      'You keep a rare print of an old classic that belongs to the cinema and have never told the owner.'),
    ch('kabir-anand', 'Kabir Anand', 'Sound designer who mixed Monsoon Letters.', 'The sound designer Vikram refused to credit properly.',
      'Vikram kept your fee and left your name off the poster.',
      'I was in the projection booth with Joseph during the interval, checking the sound levels.',
      'True. He and Joseph stayed in the booth together until the second half began.',
      'You secretly sell unused sound effects from the film online.'),
    ch('farah-sheikh', 'Farah Sheikh', 'Film critic for a national daily.', 'A critic whose harsh review of Vikram\'s last film cost him a distribution deal.',
      'Vikram threatened to ban you from his premieres and sue your paper.',
      'I was in the foyer chatting with guests and press for the whole interval.',
      'True. She stood in the foyer near the cloakroom and could see the service door.',
      'You accepted a free holiday from Vikram\'s rival in exchange for friendly coverage.'),
    ch('rajiv-sethi', 'Rajiv Sethi', "Vikram's younger brother and partner in Sethi Pictures.", "Vikram's younger brother and business partner.",
      'Vikram planned to buy out your share cheaply and push you out of the company.',
      'I stayed in the foyer talking to Dr. Rao, then went back to my seat for the second half.',
      'True. He was in the foyer within sight of the usher the whole interval.',
      'You have been borrowing from the company account to cover a failed investment.'),
    ch('meera-iyer', 'Meera Iyer', 'Publicist for Sethi Pictures, who ran the premiere.', "Vikram's publicist for six years and his right hand at events.",
      'Vikram found out you had skimmed money from the premiere budget and told you he would fire and report you tonight.',
      'I was in the foyer with the press photographers for the whole interval, then back in the auditorium for the second half.',
      'False. She left the foyer around 8:38, went through the cloakroom to the service stair, emptied a bottle of crushed tablets into the decanter, and came back down at 8:46.',
      'You have been leaking gossip about the cast to an anonymous blog for two years.'),
    ch('nandini-shah', 'Nandini Shah', "Manages the Grand Cinema's foyer bar.", 'Runs the bar that supplied the whisky for Vikram\'s box.',
      'Vikram refused to pay the bar bill for his last three premieres.',
      'I was behind the foyer bar for the whole interval, serving guests.',
      'True. She never left the bar. Earlier, around 8:20, she served Meera a glass of water.',
      'You are secretly interviewing for a job with a rival cinema chain.'),
    ch('sameer-joshi', 'Sameer Joshi', 'Owner and manager of the Grand Cinema.', 'The cinema\'s owner, who rents the hall to Sethi Pictures.',
      'Vikram had quietly offered to buy the cinema and turn it into a shopping mall.',
      'I welcomed guests in the foyer all interval and never went upstairs.',
      'True. He was in the foyer, within the usher\'s sight, until the second half began.',
      'The cinema is deep in debt and you have hidden the bank notices in your desk.')
  ],
  required: ['meera-iyer', 'hari-prasad', 'joseph-pereira', 'kabir-anand', 'farah-sheikh', 'nandini-shah'],
  solution: {
    murdererId: 'meera-iyer',
    motive: 'Vikram had found that Meera skimmed money from the premiere budget and was about to fire and report her.',
    method: 'She crushed a whole bottle of her father\'s heart tablets into the whisky decanter left on the corridor table outside Box A.',
    summary:
      'While the director and leads were on stage and Vikram worked the foyer, Meera slipped up the unwatched service stair, poisoned the decanter and returned unseen. Vikram drank it after the second half began.'
  },
  rounds: [
    {
      title: 'The body in Box A',
      publicClues: [
        pub('r1-c1', 'Vikram was found at 9:40 in the private balcony box (Box A). The doctor puts his death between 8:50 and 9:20. A very large dose of a heart medicine was dissolved in his whisky, a medicine his own doctor says he never took.'),
        pub('r1-c2', 'During the interval a stage Q&A ran in the auditorium from 8:35 to 8:48 with the director and both leads, in front of a full house.')
      ],
      privateClues: [
        pri('r1-p1', 'dr-anjali-rao', 'You know Vikram\'s heart was perfectly healthy. A dose that large would need most of a freshly filled bottle, not a few loose tablets from a strip.'),
        pri('r1-p2', 'rajiv-sethi', 'At about 7:50 you heard Vikram tell Dev Khanna that his name was coming off the top of the poster. Dev looked furious.'),
        pri('r1-p3', 'meera-iyer', 'At about 7:55 you saw Vikram send his brother Rajiv away from Box A with a sharp word. Rajiv looked angry.')
      ]
    },
    {
      title: 'Two ways upstairs',
      publicClues: [
        pub('r2-c1', 'A tray with a whisky decanter and tumbler was carried up at 8:35 and left on the corridor table outside Box A, which is beside the projection booth. Vikram came back to the box at 8:50, poured himself a drink and drank it.'),
        pub('r2-c2', 'The upper corridor has two entrances: the grand staircase, watched by the head usher, and a service stair that begins behind a staff door in the cloakroom and is not watched.')
      ],
      privateClues: [
        pri('r2-p1', 'hari-prasad', 'From your post at the bottom of the grand staircase you could see the foyer. Between 8:36 and 8:48 you saw Dr. Rao, Rajiv Sethi, Sameer Joshi, Nandini Shah and Farah Sheikh the whole time. After 8:36 you did not see Meera Iyer in the foyer at all.'),
        pri('r2-p2', 'joseph-pereira', 'From 8:35 to 8:50 you and Kabir never left the booth. At about 8:42 you glimpsed through the glass a woman\'s forearm in green glass bangles reaching over the tray on the corridor table. A pillar hid her face and you took her for a waitress.')
      ]
    },
    {
      title: 'The camera and the napkin',
      publicClues: [
        pub('r3-c1', 'Cameras cover the foyer and the grand staircase. They show Vikram in the foyer from 8:35 to 8:48 and nobody climbing the grand staircase between 8:36 and 8:48.'),
        pub('r3-c2', 'The linen napkin folded on the corridor tray smelled strongly of jasmine attar, a perfume worn by only a few people at the premiere.')
      ],
      privateClues: [
        pri('r3-p1', 'farah-sheikh', 'At 8:46, standing near the cloakroom, you saw the staff door to the service stair swing open. Meera Iyer stepped out, smoothing her hair, bangles clinking. She told you she had been in the foyer all along.'),
        pri('r3-p2', 'kabir-anand', 'You and Joseph were in the booth the whole interval and neither of you stepped into the corridor. At some point you heard bangles clink outside and thought nothing of it.'),
        pri('r3-p3', 'nandini-shah', 'Meera Iyer wore jasmine attar and green glass bangles all evening. You smelled the attar when she leaned over your bar.')
      ]
    },
    {
      title: 'The empty bottle',
      publicClues: [
        pub('r4-c1', 'Staff found an empty brown medicine bottle wedged behind the coats nearest the service door. Its label is half torn but shows a pharmacy in Matunga and the same heart medicine found in the whisky.')
      ],
      privateClues: [
        pri('r4-p1', 'nandini-shah', 'At about 8:20 Meera asked you for a glass of water and a spoon. She said her father in Matunga must never miss his heart tablets.'),
        pri('r4-p2', 'rajiv-sethi', 'Vikram told you that afternoon that he had found money missing from the premiere budget and would fire his publicist tonight.')
      ]
    }
  ],
  timeline: [
    '7:30 pm: Vikram collects the key to Box A and the premiere begins.',
    '8:20 pm: Meera asks Nandini for water, mentioning her father\'s heart tablets.',
    '8:30 pm: The interval starts. Vikram heads for the foyer.',
    '8:35 pm: The decanter and tumbler are left on the corridor table; the director and leads begin the Q&A.',
    '8:38 pm: Meera slips through the cloakroom to the service stair.',
    '8:42 pm: She empties a bottle of crushed tablets into the decanter; Joseph glimpses her bangles.',
    '8:46 pm: She comes back down the service stair and Farah sees her; she hides the empty bottle behind the coats.',
    '8:50 pm: Vikram returns to Box A, pours a drink and drinks it.',
    '9:40 pm: Vikram is found in Box A.'
  ]
};

/*
 * CASE 2: The Last Reel. Murderer: Rohit Chandra (art director). Required: rohit-chandra, sneha-kulkarni, kunal-bajaj, tanvi-rao,
 * prakash-naidu, zoya-qureshi.
 * Chain: R1 Harish fell from the Stage 4 gantry at 10:20 (watch); the rail was tight at 6:30 (Prakash) so it was loosened after.
 * R2 the only way up is a card-locked ladder door: swipes at 10:05, 10:12 (Harish) and 10:26, the first and last by the same
 * department-head card, so a department head was up there 10:05-10:26. Privately Sneha clears Lata (green room 10:00-10:30) and Kunal
 * clears Zoya, Imran and Prakash (in the commissary 10:10-10:30), leaving the art director. R3 monsoon-blue paint (only the art store
 * has it) and Tanvi finding Stage 2 locked and dark, which breaks Rohit's alibi. R4 Harish's 9:50 message to the "Art Dept" phone
 * (Rohit's own, Tanvi) and Zoya's knowledge that the sale needed the village set gone.
 */
const LAST_REEL: MurderCaseDef = {
  id: 'last-reel',
  title: 'The Last Reel',
  tagline: 'A wrap party on a film studio backlot and a fall from the gantry.',
  blurb:
    'Sunrise Studios, Mumbai, is throwing a wrap party for its final film. At 11:05 pm its founder is found at the foot of the Stage 4 lighting gantry. A fall, say the police at first. The loosened rail says otherwise.',
  victim: {
    name: 'Harish Menon',
    bio: 'Founder and chairman of Sunrise Studios, a legend who ruled the backlot for forty years.',
    causeOfDeath: 'A fall from the lighting gantry above Stage 4.'
  },
  characters: [
    ch('rohit-chandra', 'Rohit Chandra', 'Art director of Sunrise Studios and builder of its famous village set.', "Harish's art director for twenty years.",
      'Harish secretly agreed to sell the backlot to a developer who will bulldoze your village set, and mocked you when you objected.',
      'I was alone on Stage 2 from 9:45, hanging lanterns for the photo booth, until I heard the shouting at 11.',
      'False. Stage 2 was locked and dark. Rohit swiped into the gantry ladder door at 10:05, loosened the rail, argued with Harish, pushed him against it at 10:20 and left at 10:26.',
      'You have been secretly designing sets for a rival studio for a year.'),
    ch('lata-deshpande', 'Lata Deshpande', 'Head of the costume department.', "Harish's costume head and old friend.",
      'Harish promised you the studio wardrobe archive and then planned to sell it with the building.',
      'I was in the green room pinning Sneha\'s gown from 10:00 to 10:30.',
      'True. She and Sneha did not leave the green room.',
      'You have been selling vintage costumes from the archive to collectors.'),
    ch('prakash-naidu', 'Prakash Naidu', 'Head of stunts and set safety.', 'Harish\'s safety chief, who once refused to sign off on a risky stunt.',
      'Harish blamed you for a stunt accident and said he would fire you after the party.',
      'I sat at the head table and gave the safety toast at 10:20.',
      'True. He was in the commissary from 10:10 to 10:30. At 6:30 he had tested every bolt on the Stage 4 gantry rail.',
      'You take painkillers for a back injury and hide it so you stay on stunt duty.'),
    ch('zoya-qureshi', 'Zoya Qureshi', 'Head of accounts and finance.', 'The studio\'s chief accountant, who knew every rupee Harish spent.',
      'You found out Harish had hidden the studio\'s losses and feared you would be blamed.',
      'I sat at the head table through all the speeches.',
      'True. She stayed at the head table from 10:00 to 10:35.',
      'You have been taking small loans from the staff welfare fund, meaning to repay them.'),
    ch('imran-sheikh', 'Imran Sheikh', 'Head of the sound department.', 'Harish\'s sound chief, who built the studio\'s recording stage.',
      'Harish planned to scrap the sound stage you built with your own hands.',
      'I ran the sound desk beside the commissary stage all evening.',
      'True. He sat at the sound desk beside the stage the whole party.',
      'You have been secretly recording conversations around the lot for years, just for fun.'),
    ch('sneha-kulkarni', 'Sneha Kulkarni', 'Lead actress of the final film.', 'Harish\'s star, whom he discovered as a teenager.',
      'Harish refused to release you from your contract so you could join a streaming series.',
      'I was in the green room having my gown pinned by Lata from 10:00 to 10:30.',
      'True. She was pinned into her gown and could not move.',
      'You have already signed a secret deal with a streaming platform.'),
    ch('kunal-bajaj', 'Kunal Bajaj', 'Assistant director and host of the wrap party.', 'Harish\'s assistant director, who ran the lot\'s daily schedule.',
      'Harish promised you a directing debut and quietly gave it to his nephew.',
      'I hosted the party from the commissary stage from 10:00 to 10:35.',
      'True. From the stage he could see the head table and the sound desk the whole time.',
      'You are terrified of speaking in public and take pills before every event.'),
    ch('tanvi-rao', 'Tanvi Rao', 'Junior assistant in the art department.', 'Rohit\'s assistant, who joined the studio two years ago.',
      'Harish humiliated you in front of the whole crew over a paint mistake.',
      'At 10:00 I walked to Stage 2 to ask Rohit for the art store padlock key, found it locked and dark, and was back at the commissary by 10:15.',
      'True. Stage 2 was padlocked from outside and nobody answered her knock. She holds the key to the art store.',
      'You painted the famous village set mural that Rohit takes credit for.'),
    ch('arjun-malhotra', 'Arjun Malhotra', 'Male lead of the final film.', 'Harish\'s leading man for fifteen years.',
      'Harish refused to give you the producer credit he had promised.',
      'I was in my trailer with my make-up artist until 10:30, then went to the party.',
      'True. His make-up artist was with him until 10:30.',
      'You are secretly planning to quit acting for politics.'),
    ch('nisha-kapoor', 'Nisha Kapoor', 'Legal counsel of the studio.', 'Harish\'s lawyer, who drafted his contracts.',
      'Harish planned to fire you after learning you had leaked details of the sale to the press.',
      'I was in the studio office on a call with the buyer\'s lawyers from 10:00 until 10:40.',
      'True. The call log confirms it.',
      'You failed your bar exam twice and have hidden it from the studio.'),
    ch('dilip-patil', 'Dilip Patil', 'Head of security at the main gate.', 'The gatekeeper who has known Harish since the studio opened.',
      'Harish promised you a cottage on the lot for your retirement and then announced the sale.',
      'I was at the main gate logging cars until 11, when I heard the shouting.',
      'True. The gate log shows him at his desk all evening.',
      'You let your cousin sneak onto the lot to watch the filming.'),
    ch('meenakshi-iyengar', 'Meenakshi Iyengar', 'Film editor and keeper of the studio\'s film vault.', 'Harish\'s editor for thirty years.',
      'Harish planned to sell the old negatives in the vault to a collector, destroying the archive you saved.',
      'I was in the editing suite all evening watching the final reel and did not go to the party.',
      'True. She never left the editing suite.',
      'You hid a damaged reel of Harish\'s first film that he believed was lost.')
  ],
  required: ['rohit-chandra', 'sneha-kulkarni', 'kunal-bajaj', 'tanvi-rao', 'prakash-naidu', 'zoya-qureshi'],
  solution: {
    murdererId: 'rohit-chandra',
    motive: 'Harish had agreed to sell the backlot to a developer who would bulldoze Rohit\'s village set, and had mocked him for objecting.',
    method: 'Rohit loosened the end bolt of the gantry rail with a hex key, then pushed Harish against it during their argument.',
    summary:
      'Rohit arranged to meet Harish on the gantry, loosened the rail beforehand and pushed him against it at 10:20. He left by the same door and joined the party as if he had been on Stage 2 all along.'
  },
  rounds: [
    {
      title: 'The fall',
      publicClues: [
        pub('r1-c1', 'Harish was found at 11:05 pm at the foot of the Stage 4 lighting gantry. His cracked wristwatch had stopped at 10:20.'),
        pub('r1-c2', 'About eighty guests were at the commissary party from 10:00 to 10:35. Harish was due to give a speech there at 10:30 and never arrived.')
      ],
      privateClues: [
        pri('r1-p1', 'prakash-naidu', 'At 6:30 that evening you tested every bolt on the Stage 4 gantry rail. All of them were tight and the rail was safe.'),
        pri('r1-p2', 'nisha-kapoor', 'At 9:15 Harish told you the sale papers would be signed at midnight, but that he had one old argument to finish first on the gantry. He did not say with whom.'),
        pri('r1-p3', 'rohit-chandra', 'At about 6 pm you saw Harish and Arjun Malhotra arguing sharply outside the film vault about money.')
      ]
    },
    {
      title: 'The ladder door and the rail',
      publicClues: [
        pub('r2-c1', 'The only way onto the gantry is a ladder behind the prop store. Its door opens by keycard and records every swipe: 10:05, 10:12 and 10:26. The 10:12 swipe was Harish\'s own card. The other two came from the same card, a department-head grade card.'),
        pub('r2-c2', 'The end bolt of the gantry rail had been loosened and the rail gave way. A hex key of the size used on set pieces lay beside it.')
      ],
      privateClues: [
        pri('r2-p1', 'sneha-kulkarni', 'From 10:00 to 10:30 you were in the green room while Lata pinned your gown. Neither of you left.'),
        pri('r2-p2', 'kunal-bajaj', 'From the commissary stage between 10:10 and 10:30 you saw Zoya Qureshi at the head table, Imran Sheikh at the sound desk and Prakash Naidu, who gave the safety toast at 10:20. None of them left.')
      ]
    },
    {
      title: 'Paint and padlock',
      publicClues: [
        pub('r3-c1', 'A smear of monsoon blue paint was on the gantry rail. That exact mix was made only for the new Stage 4 sets and is kept in the art department store.'),
        pub('r3-c2', 'Stage 2 and the prop store are at opposite ends of the lot, about six minutes apart on foot.')
      ],
      privateClues: [
        pri('r3-p1', 'tanvi-rao', 'At 10:00 you went to Stage 2 to ask Rohit for the art store padlock key. The door was padlocked from outside, the lights were off and nobody answered. Stage 2 stayed dark until about 10:40.'),
        pri('r3-p2', 'meenakshi-iyengar', 'At 9:30 you saw Harish carrying a roll of papers towards Stage 4, humming cheerfully.')
      ]
    },
    {
      title: 'The message',
      publicClues: [
        pub('r4-c1', 'Harish\'s phone shows a message sent at 9:50 to the contact saved as Art Dept: "Gantry, 10:15. Come alone. We settle the sets tonight."')
      ],
      privateClues: [
        pri('r4-p1', 'tanvi-rao', 'The Art Dept number in the studio directory is Rohit\'s own phone. The spare sits in the locked art store, and when you checked at 11 it had no messages.'),
        pri('r4-p2', 'zoya-qureshi', 'At 9:45 Harish told you the buyer had one condition: the village set must be gone by Monday. He said, "Someone who loves it will never forgive me."')
      ]
    }
  ],
  timeline: [
    '6:30 pm: Prakash tests the gantry rail and finds it safe.',
    '9:50 pm: Harish messages the Art Dept phone: meet on the gantry at 10:15.',
    '10:00 pm: Tanvi finds Stage 2 padlocked and dark.',
    '10:05 pm: Rohit swipes into the gantry ladder door and loosens the end bolt of the rail.',
    '10:12 pm: Harish arrives and the argument begins.',
    '10:20 pm: Rohit pushes Harish against the loosened rail; it gives way and Harish\'s watch stops.',
    '10:26 pm: Rohit leaves through the same door, brushing the rail with a paint-stained sleeve.',
    '10:40 pm: He walks to Stage 2 and then to the party as though he had been there all evening.',
    '11:05 pm: Harish is found.'
  ]
};

/*
 * CASE 3: Midnight on the Monsoon Express. Murderer: Savitri Pillai (retired teacher). Required: savitri-pillai, bunty-yadav,
 * dr-nikhil-sinha, major-dalip-singh, clara-fernandes, raghu-nair.
 * Chain: R1 Girish was struck 12:45-1:30 after ordering tea for two on his own (Bunty: for "an old friend"). R2 a lounge bookend wiped
 * clean under his berth with a grey-blue wool strand, and a card game with a gap from 12:58 to 1:16 because one chair was empty.
 * Privately the Major and Dr. Sinha vouch for each other and Sinha saw Gupta and Clara at the table at 1:02; Bunty counted four
 * players and one empty chair at 1:02. R3 nobody left or boarded at the Igatpuri halt, so the killer was aboard; Clara knows only
 * Mrs Pillai knitted grey-blue wool. R4 the victim's diary names "S." (Savitri, Sinha, Singh) and Raghu saw a lady in a grey-blue
 * shawl hurry back to the lounge at 1:15, which with the empty chair leaves only Savitri.
 */
const MONSOON_EXPRESS: MurderCaseDef = {
  id: 'monsoon-express',
  title: 'Midnight on the Monsoon Express',
  tagline: 'An overnight luxury train, a card game and a locked-in killer.',
  blurb:
    'The Monsoon Express rolls through the night from Mumbai to Goa. At dawn the steward finds Cabin 5 silent: the antique dealer inside will never wake. The train never stopped for long, so the answer is still on board.',
  victim: {
    name: 'Girish Thakkar',
    bio: 'Antiques dealer with a case of rare treasures and a long memory for old debts.',
    causeOfDeath: 'A blow to the head.'
  },
  characters: [
    ch('major-dalip-singh', 'Major Dalip Singh', 'Retired army major and fierce card player.', 'An old acquaintance who once lent Girish money.',
      'Girish refused to repay a large loan and left you nearly bankrupt.',
      'I played cards in the lounge car from 12:30 until well past 1:30 and never left the table.',
      'True. He sat opposite Dr. Sinha all night and never left the table.',
      'You cheat at cards and have done for years.'),
    ch('savitri-pillai', 'Savitri Pillai', 'Retired schoolteacher travelling to Goa to visit her sister.', 'Once taught Girish at school; later her husband\'s shop fell to Girish\'s debt-collecting.',
      'Girish bought your late husband\'s debts and was about to take your last cottage; he laughed when you begged him to wait.',
      'I played cards in the lounge car all night, leaving once for ten minutes at most to fetch my heart tablets from my cabin.',
      'False. She was away from the table for eighteen minutes, from 12:58 to 1:16. She took a brass bookend in her knitting bag, went to Cabin 5 where Girish had invited her for tea, and struck him. Her tablets were in her handbag all along.',
      'You pretend to be comfortably off but live on your sister\'s charity.'),
    ch('arvind-gupta', 'Arvind Gupta', 'Jeweller from Surat on his way to a trade fair.', 'Girish\'s biggest rival in the antiques trade.',
      'Girish sold a forged piece in your name and ruined your reputation.',
      'I was at the card table all night and lit a cigar there around one o\'clock.',
      'True. He sat at the table from 12:30 until 1:30.',
      'You smuggle small gems in the lining of your suitcase.'),
    ch('clara-fernandes', 'Clara Fernandes', 'Travel journalist from Goa.', 'Girish\'s target: he threatened to sue her over an article about forged antiques.',
      'Girish threatened to ruin you with a lawsuit over your article.',
      'I was at the card table with the Major and Dr. Sinha all night; around one I was showing Dr. Sinha a card trick.',
      'True. She was at the table from 12:30 to 1:30.',
      'You write for rival magazines under a false name.'),
    ch('dr-nikhil-sinha', 'Dr. Nikhil Sinha', 'Retired surgeon on holiday.', 'Treated Girish for years and knew his health secrets.',
      'Girish knew you once made a serious mistake in an operation on his sister and promised to expose you.',
      'I played cards all night and never left the table.',
      'True. He was at the table from 12:30 to 1:30.',
      'You write poetry under a false name and are deeply embarrassed by it.'),
    ch('bunty-yadav', 'Bunty Yadav', 'Steward of the lounge car and Carriage B.', 'The steward who served Girish all journey.',
      'Girish accused you of stealing a silver snuffbox and threatened to have you dismissed.',
      'I was serving drinks in the lounge car, delivered tea to Cabin 5 at 1:00 and went straight back.',
      'True. He delivered the tray at 1:00 and was back in the lounge at 1:02.',
      'You sell leftover liquor to passengers.'),
    ch('raghu-nair', 'Raghu Nair', 'Ticket examiner of the Monsoon Express.', 'Girish rode your train twice a year and always complained.',
      'Girish reported your rude behaviour to the railway board and you faced dismissal.',
      'I checked tickets in Carriage B at 1:05 and stood at the vestibule until the halt ended.',
      'True. At 1:05 he walked past Cabin 5. At 1:12 he stood at the vestibule until the train left Igatpuri.',
      'You sleep through your night rounds more often than you admit.'),
    ch('priya-thakkar', 'Priya Thakkar', 'Girish\'s niece and heir apparent.', 'Girish\'s niece who travelled with him.',
      'Girish\'s will left everything to a museum and cut you out.',
      'I went to bed in Cabin 4 at 11:55 and slept until the steward woke me at 6.',
      'True. She was asleep in Cabin 4.',
      'You dream of leaving home to become a dancer and have told nobody.'),
    ch('chandni-rao', 'Chandni Rao', 'Girish\'s secretary.', 'Girish\'s secretary of five years.',
      'Girish never paid your last three months of salary.',
      'I stayed in Cabin 6 doing his accounts until I fell asleep around one.',
      'True. She fell asleep over the accounts in Cabin 6.',
      'You copied his client list and sold it to a rival.'),
    ch('winifred-harcourt', 'Lady Winifred Harcourt', 'British widow touring India.', 'Girish sold her a Mughal miniature that turned out to be fake.',
      'Girish refused to refund you for a forged painting.',
      'I retired to Cabin 7 at midnight with a book and a glass of warm milk.',
      'True. She stayed in Cabin 7 and heard the corridor through the thin wall.',
      'You are not titled at all: you invented the Lady years ago.'),
    ch('rustom-batliwala', 'Rustom Batliwala', 'Girish\'s young apprentice.', 'Girish\'s apprentice for three years.',
      'Girish underpaid you and threatened to ruin your name when you wanted to leave.',
      'I stayed in Cabin 3 polishing silver until 1:30.',
      'True. He polished silver alone in Cabin 3.',
      'You made some of the fakes Girish sold and have never told anyone.'),
    ch('hamid-qazi', 'Hamid Qazi', 'Chef of the Monsoon Express.', 'Cooks for the special dinners Girish ordered.',
      'Girish insulted your cooking in public and demanded that you be sacked.',
      'I was in the galley washing up until 1:15.',
      'True. He washed up alone in the galley.',
      'You serve leftovers as fresh food the next day.')
  ],
  required: ['savitri-pillai', 'bunty-yadav', 'dr-nikhil-sinha', 'major-dalip-singh', 'clara-fernandes', 'raghu-nair'],
  solution: {
    murdererId: 'savitri-pillai',
    motive: 'Girish held the debts on her late husband\'s shop and was about to take her last cottage; he laughed at her plea.',
    method: 'She struck him once with a brass elephant bookend taken from the lounge in her knitting bag, wiped it with her shawl and pushed it under his berth.',
    summary:
      'Girish invited Savitri for tea at one to discuss her debts. She slipped away from the card game with the bookend, struck him during their argument and was back at the table by 1:16, claiming she had fetched her tablets.'
  },
  rounds: [
    {
      title: 'Cabin 5',
      publicClues: [
        pub('r1-c1', 'Girish was found at 6:10 am in Cabin 5 by the steward, struck once on the head. The doctor on board puts his death between 12:45 and 1:30 am.'),
        pub('r1-c2', 'At 1:00 am the steward delivered tea for two to Cabin 5, on Girish\'s own order.')
      ],
      privateClues: [
        pri('r1-p1', 'bunty-yadav', 'At 12:30 Girish stopped you at the lounge doorway and ordered tea for two at one o\'clock sharp, saying an old friend wanted a word with him.'),
        pri('r1-p2', 'priya-thakkar', 'As you were going to sleep at 11:55 you heard your uncle through the thin wall muttering, "Old debts, tonight, one o\'clock. Be firm."'),
        pri('r1-p3', 'chandni-rao', 'You know the safe in Cabin 5 holds his best pieces. When you checked at dawn it had not been opened, so nothing was stolen.')
      ]
    },
    {
      title: 'The bookend and the card game',
      publicClues: [
        pub('r2-c1', 'One of the pair of brass elephant bookends from the lounge shelf was missing. It was found wiped clean under Girish\'s berth, with a strand of grey-blue wool caught at its base.'),
        pub('r2-c2', 'Five passengers played cards in the lounge car from 12:30 to past 1:30. Their score sheet shows no hand was played between 12:58 and 1:16 because one chair was empty.')
      ],
      privateClues: [
        pri('r2-p1', 'major-dalip-singh', 'You never left the table, and neither did Dr. Sinha: he was your opponent all night and you would have noticed.'),
        pri('r2-p2', 'dr-nikhil-sinha', 'At about 1:02 you saw Arvind Gupta light a cigar at the table and Clara showing you a card trick. You and the Major were both in your seats.')
      ]
    },
    {
      title: 'The halt at Igatpuri',
      publicClues: [
        pub('r3-c1', 'The train stood at Igatpuri from 1:10 to 1:20. Platform cameras show nobody boarding or leaving Carriage B, so the person responsible was on the train all along.'),
        pub('r3-c2', 'Girish\'s reading lamp was on and the second cup of tea stood untouched on the tray: he had not yet poured for his guest.')
      ],
      privateClues: [
        pri('r3-p1', 'clara-fernandes', 'All evening Mrs Pillai knitted a grey-blue shawl at the card table, and later wore it round her shoulders. You saw nobody else with that wool.'),
        pri('r3-p2', 'savitri-pillai', 'At about 11:40 in the dining car you saw Arvind Gupta in a loud argument with Girish about a sapphire called the Monsoon Star.'),
        pri('r3-p3', 'bunty-yadav', 'At 1:02, setting down a round of drinks in the lounge, you counted four players at the card table and one empty chair. You were busy and cannot say whose chair it was.')
      ]
    },
    {
      title: 'The diary',
      publicClues: [
        pub('r4-c1', 'Girish\'s pocket diary has an entry for that night: "1 am. S. is coming to beg again. Tea for two. Be firm."')
      ],
      privateClues: [
        pri('r4-p1', 'raghu-nair', 'At 1:05 you passed Cabin 5: the door was shut and a light shone under it. At 1:15 near the vestibule you saw a lady in a grey-blue shawl hurry back towards the lounge, clutching a knitting bag. You did not see her face.'),
        pri('r4-p2', 'winifred-harcourt', 'At 1:00 you heard the steward\'s trolley stop outside Cabin 5 and a man say, "Thank you, put it down."')
      ]
    }
  ],
  timeline: [
    '11:40 pm: Gupta argues loudly with Girish in the dining car.',
    '11:55 pm: Girish goes to Cabin 5, muttering about old debts.',
    '12:30 am: The card game starts. Girish orders tea for two at one for "an old friend".',
    '12:55 am: Savitri tucks a brass bookend from the lounge into her knitting bag.',
    '12:58 am: She leaves the table and goes to Cabin 5.',
    '1:00 am: Bunty delivers the tea. Savitri enters at about 1:01.',
    '1:05 am: After an argument over her debts, she strikes Girish; Raghu passes the shut door.',
    '1:10 am: The train halts at Igatpuri.',
    '1:16 am: Savitri is back at the table, claiming she fetched her tablets.',
    '6:10 am: Girish is found.'
  ]
};

export const MURDER_CASES: readonly MurderCaseDef[] = [GRAND_CINEMA, LAST_REEL, MONSOON_EXPRESS];

export function getMurderCase(id: string): MurderCaseDef | undefined {
  return MURDER_CASES.find((c) => c.id === id);
}

export function murderCaseSummaries(): MurderCaseSummary[] {
  return MURDER_CASES.map((c) => ({ id: c.id, title: c.title, tagline: c.tagline, blurb: c.blurb, victimName: c.victim.name }));
}
