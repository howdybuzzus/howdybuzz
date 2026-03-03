const CONFIG = {
  GITHUB_TOKEN: 'YOUR_GITHUB_TOKEN_HERE',
  GITHUB_USER: 'howdybuzzus',
  REPO_NAME: 'howdybuzz',
  BRANCH: 'main',
  SITE_URL: 'https://howdybuzz.com'
};

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('??? HowdyBuzz Admin')
    .addItem('?? Manual Publish: Weekly Exam Review', 'promptWeeklyExamPublish')
    .addSeparator()
    .addItem('??? Delete a Daily/Recap Post', 'promptDeleteDaily')
    .addItem('??? Delete an Exam Post', 'promptDeleteExam')
    .addItem('??? Delete a Word HTML', 'promptDeleteWord')
    .addSeparator()
    .addItem('?? Force Sync Master Vault (A-Z)', 'forceVaultSync')
    .addToUi();
}

function mainPublisher() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const vaultSheet = ss.getSheetByName('Master_Vault'); 
  const scheduleSheet = ss.getSheetByName('Exam_Schedule'); 
  
  if (!vaultSheet) { Logger.log(Error: 'Master_Vault' missing.); return; }
  
  const today = new Date();
  const todayString = Utilities.formatDate(today, "GMT+5:30", "yyyy-MM-dd");
  const dayName = Utilities.formatDate(today, "GMT+5:30", "EEEE");
  
  const vaultData = vaultSheet.getDataRange().getValues();
  const vaultHeaders = vaultData[0].map(h => h.toString().trim().toLowerCase()); 

  Logger.log(Executing Standard Daily Drop Protocol...);
  publishDailyDrop(vaultData, vaultHeaders, vaultSheet, todayString, dayName, today);

  if (scheduleSheet) {
    Logger.log(Checking Exam Schedule for automated drops...);
    checkAndPublishScheduledExams(scheduleSheet, vaultData, vaultHeaders, todayString);
  }

  Logger.log(Commencing A-Z Vault synchronization...);
  updateMasterVaultData(vaultData, vaultHeaders, today);
}

function checkAndPublishScheduledExams(scheduleSheet, vaultData, vaultHeaders, todayString) {
  const schedData = scheduleSheet.getDataRange().getValues();
  if (schedData.length <= 1) return; // Empty schedule
  
  let schedHeaders = schedData[0].map(h => h.toString().trim().toLowerCase());
  let dateIdx = schedHeaders.indexOf(post_date);
  let trackIdx = schedHeaders.indexOf(exam_track);
  let batchIdx = schedHeaders.indexOf(atch_id);

  if (dateIdx === -1 || trackIdx === -1 || batchIdx === -1) {
    Logger.log(Warning: Exam_Schedule sheet is missing required columns.);
    return;
  }

  for (let i = 1; i < schedData.length; i++) {
    let postDate = schedData[i][dateIdx];
    if (postDate instanceof Date) {
      if (Utilities.formatDate(postDate, "GMT+5:30", "yyyy-MM-dd") === todayString) {
         let trackName = schedData[i][trackIdx].toString().trim().toLowerCase();
         let batchId = schedData[i][batchIdx].toString().trim();
         
         if (trackName && batchId) {
             Logger.log(\Found scheduled post: \ for Batch \\);
             
             if (trackName.includes('review') || trackName.includes('recap')) {
                 executeWeeklyRecap(batchId, vaultData, vaultHeaders, postDate);
             } else {
                 executeExamPublish(trackName, batchId, vaultData, vaultHeaders, postDate);
             }
         }
      }
    }
  }
}

function executeWeeklyRecap(batchIdText, data, headers, todayObj) {
  const publishDateStr = Utilities.formatDate(todayObj, "GMT+5:30", "yyyy-MM-dd");
  const monthName = Utilities.formatDate(todayObj, "GMT+5:30", "MMM").toUpperCase(); 
  const dayOfMonth = Utilities.formatDate(todayObj, "GMT+5:30", "dd");
  const year = Utilities.formatDate(todayObj, "GMT+5:30", "yyyy");
  
  const batchIndex = headers.indexOf('batch_id');
  if (batchIndex === -1) return;

  let validWords = [];
  for (let i = 1; i < data.length; i++) { 
    let rowBatchId = data[i][batchIndex]; 
    if (rowBatchId && rowBatchId.toString().trim() === batchIdText) {
        let wordObj = {};
        data[0].forEach((header, index) => { wordObj[header.toString().trim()] = data[i][index]; });
        validWords.push(wordObj);
    }
  }

  if (validWords.length === 0) return;

  const pageHtml = buildSundayRecapPage(validWords, publishDateStr, batchIdText);
  const pagePath = \daily/\-recap.html\;
  pushToGithub(pagePath, pageHtml, \Auto-Publish Weekly Recap (Batch \)\);
  
  const cardData = { 
    day: dayOfMonth, 
    month: monthName, 
    year: year, 
    editionNumber: \\ Words\, 
    dayName: "Sunday Megadrop", 
    title: \The Weekly Recap: Batch \\, 
    description: \A comprehensive review of highly-tested words from Batch \.\, 
    tags: ["Weekly Recap"], 
    link: pagePath 
  };
  
  updateArchiveFileTargeted(buildArchiveCard(cardData), \daily-archives.html\, \daily-feed-container\);
}

function executeExamPublish(examKey, batchIdText, data, headers, todayObj) {
  const publishDateStr = Utilities.formatDate(todayObj, "GMT+5:30", "yyyy-MM-dd");
  const monthName = Utilities.formatDate(todayObj, "GMT+5:30", "MMM").toUpperCase(); 
  const dayOfMonth = Utilities.formatDate(todayObj, "GMT+5:30", "dd");
  const year = Utilities.formatDate(todayObj, "GMT+5:30", "yyyy");
  
  const nuanceIndex = headers.indexOf(\\_nuance\);
  const batchIndex = headers.indexOf('batch_id');
  if (nuanceIndex === -1 || batchIndex === -1) return;

  let validWords = [];
  for (let i = 1; i < data.length; i++) { 
    let rowBatchId = data[i][batchIndex]; 
    if (rowBatchId && rowBatchId.toString().trim() === batchIdText) {
        let wordObj = {};
        data[0].forEach((header, index) => { wordObj[header.toString().trim()] = data[i][index]; });
        let nuanceText = data[i][nuanceIndex];
        if (nuanceText && nuanceText.toString().trim() !== "") { validWords.push(wordObj); }
    }
  }
  if (validWords.length === 0) return;

  const pageHtml = buildWeeklyExamPage(validWords, examKey, publishDateStr, batchIdText);
  const pagePath = \\-weekly/\.html\;
  pushToGithub(pagePath, pageHtml, \Auto-Publish \ Review (Batch \)\);
  
  const cardData = { 
    day: dayOfMonth, 
    month: monthName, 
    year: year, 
    editionNumber: \Batch \\, 
    dayName: "Weekly Review", 
    title: \\ Vocabulary: Batch \ Masterclass\, 
    description: \A systematic breakdown of testing context, traps, and application for highly-tested words in Batch \.\, 
    tags: [examKey.toUpperCase()], 
    link: pagePath 
  };
  
  updateArchiveFileTargeted(buildArchiveCard(cardData), \\-archives.html\, \\-feed-container\);
}

function publishDailyDrop(vaultData, vaultHeaders, vaultSheet, todayString, dayName, today) {
  let todaysWords = [];
  for (let i = 1; i < vaultData.length; i++) {
    let rowObjLowercase = {};
    vaultHeaders.forEach((header, index) => { rowObjLowercase[header] = vaultData[i][index]; });
    let dailyDate = rowObjLowercase["daily_date"] || rowObjLowercase["publish_date"];
    if (dailyDate instanceof Date) {
      if (Utilities.formatDate(dailyDate, "GMT+5:30", "yyyy-MM-dd") === todayString) {
        let originalObj = {};
        vaultData[0].forEach((header, index) => { originalObj[header.toString().trim()] = vaultData[i][index]; });
        todaysWords.push(originalObj);
      }
    }
  }

  if (todaysWords.length === 0) return;

  let editionCell = vaultSheet.getRange("Z1"); 
  let currentEdition = editionCell.getValue();
  if (typeof currentEdition !== 'number') { currentEdition = 0; }
  let newEdition = currentEdition + 1;

  todaysWords.forEach(word => { pushToGithub(\word/\.html\, buildVaultPage(word), \Update Word: \\); });

  const dailyPagePath = \daily/\.html\;
  pushToGithub(dailyPagePath, buildDaily5Page(todaysWords, dayName, todayString), \New Daily Page: \\);

  const monthName = Utilities.formatDate(today, "GMT+5:30", "MMM").toUpperCase();
  const dayOfMonth = Utilities.formatDate(today, "GMT+5:30", "dd");
  const year = Utilities.formatDate(today, "GMT+5:30", "yyyy");

  const cardData = { 
    day: dayOfMonth, 
    month: monthName, 
    year: year, 
    editionNumber: "#" + newEdition, 
    dayName: dayName + " Drop", 
    title: \\, \, \...\, 
    description: todaysWords[0].Blog_Intro || "Today's curated vocabulary set for global exam mastery."\, 
    tags: ["Vocabulary"], 
    link: dailyPagePath 
  };
  updateArchiveFileTargeted(buildArchiveCard(cardData), "daily-archives.html", "daily-feed-container");
  
  editionCell.setValue(newEdition); 
}

function updateMasterVaultData(allWordsData, headers, todayObj) {
  let buckets = {};
  'abcdefghijklmnopqrstuvwxyz'.split('').forEach(l => buckets[l] = []);
  
  for (let i = 1; i < allWordsData.length; i++) {
    let wordObj = {};
    headers.forEach((header, index) => { wordObj[header] = allWordsData[i][index]; });
    let wText = wordObj["word"]; let dText = wordObj["definition"];
    let vDate = wordObj["vault_date"] || wordObj["publish_date"];
    let pText = wordObj["part_of_speech"] || wordObj["category"] || "";
    if (wText && dText && wText.toString().trim() !== "" && dText.toString().trim() !== "") { 
        if ((vDate instanceof Date) && (vDate <= todayObj)) {
           let firstLetter = wText.toString().trim().charAt(0).toLowerCase();
           if (buckets[firstLetter]) { buckets[firstLetter].push({ id: i, word: wText.toString().trim(), pos: pText.toString().trim(), def: dText.toString().trim(), ex: wordObj["master_sentence"] ? wordObj["master_sentence"].toString().trim() : "", exams: ["Vocabulary"] }); }
        }
    }
  }
  
  'abcdefghijklmnopqrstuvwxyz'.split('').forEach(letter => {
     let mappedWords = buckets[letter];
     const jsContent = "window.vaultData = " + JSON.stringify(mappedWords, null, 2) + ";";
     if(pushToGithub(\ault/data-\.js\, jsContent, \Refresh Vault Bucket [\]\)) { 
        Utilities.sleep(1200); 
     }
  });
}

function forceVaultSync() { 
  const data = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Master_Vault').getDataRange().getValues(); 
  const t = new Date(); t.setHours(23, 59, 59, 999); 
  updateMasterVaultData(data, data[0].map(h => h.toString().trim().toLowerCase()), t); 
  SpreadsheetApp.getUi().alert("? Vault Synced securely via A-Z fragmentation!"); 
}

function updateArchiveFileTargeted(newCardHtml, targetPath, containerId) {
  const url = \https://api.github.com/repos/\/\/contents/\\;
  try {
    let res = UrlFetchApp.fetch(url, { method: "get", headers: { "Authorization": "token " + CONFIG.GITHUB_TOKEN }, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return;
    const json = JSON.parse(res.getContentText());
    const oldContent = Utilities.newBlob(Utilities.base64Decode(json.content)).getDataAsString();
    const match = oldContent.match(new RegExp(\<div id="\" class="[\\s\\S]*?">\, "i"));
    if (!match) return;
    UrlFetchApp.fetch(url, { method: "put", headers: { "Authorization": "token " + CONFIG.GITHUB_TOKEN }, payload: JSON.stringify({ message: \System: Update \\, content: Utilities.base64Encode(Utilities.newBlob(oldContent.replace(match[0], match[0] + "\\n" + newCardHtml)).getBytes()), sha: json.sha, branch: CONFIG.BRANCH }), contentType: "application/json", muteHttpExceptions: true });    
  } catch (e) {}
}

function pushToGithub(path, content, message) {
  const url = \https://api.github.com/repos/\/\/contents/\\;
  const encodedContent = Utilities.base64Encode(Utilities.newBlob(content).getBytes());
  let sha = "";
  try {
    let res = UrlFetchApp.fetch(url, { method: "get", headers: {"Authorization": "token " + CONFIG.GITHUB_TOKEN}, muteHttpExceptions: true });
    if (res.getResponseCode() === 200) sha = JSON.parse(res.getContentText()).sha;
  } catch (e) {}
  const pay = { message: message, content: encodedContent, branch: CONFIG.BRANCH };
  if (sha) pay.sha = sha;
  let rep = UrlFetchApp.fetch(url, { method: "put", headers: {"Authorization": "token " + CONFIG.GITHUB_TOKEN}, payload: JSON.stringify(pay), contentType: "application/json", muteHttpExceptions: true });
  return rep.getResponseCode() === 200 || rep.getResponseCode() === 201;
}

function deleteFileFromGithub(filePath) { 
  const url = \https://api.github.com/repos/\/\/contents/\\; 
  let res = UrlFetchApp.fetch(url, { method: "get", headers: { "Authorization": "token " + CONFIG.GITHUB_TOKEN }, muteHttpExceptions: true }); 
  if (res.getResponseCode() === 404) return false; 
  let delRes = UrlFetchApp.fetch(url, { method: "delete", headers: { "Authorization": "token " + CONFIG.GITHUB_TOKEN }, payload: JSON.stringify({ message: \Delete \\, sha: JSON.parse(res.getContentText()).sha, branch: CONFIG.BRANCH }), contentType: "application/json", muteHttpExceptions: true }); 
  return (delRes.getResponseCode() === 200); 
}

function removeCardFromArchives(archivePath, targetId) { 
  const url = \https://api.github.com/repos/\/\/contents/\\; 
  try { 
    let res = UrlFetchApp.fetch(url, { method: "get", headers: { "Authorization": "token " + CONFIG.GITHUB_TOKEN }, muteHttpExceptions: true }); 
    if (res.getResponseCode() !== 200) return; 
    const json = JSON.parse(res.getContentText()); 
    let oldContent = Utilities.newBlob(Utilities.base64Decode(json.content)).getDataAsString(); 
    const regex = new RegExp(\<!-- Card for.*?-->\\s*<article[\\s\\S]*?\[\\s\\S]*?</article>\, "gi"); 
    let newContent = oldContent.replace(regex, ""); 
    if (newContent !== oldContent) { UrlFetchApp.fetch(url, { method: "put", headers: { "Authorization": "token " + CONFIG.GITHUB_TOKEN }, payload: JSON.stringify({ message: \Removing card\, content: Utilities.base64Encode(Utilities.newBlob(newContent).getBytes()), sha: json.sha, branch: CONFIG.BRANCH }), contentType: "application/json", muteHttpExceptions: true }); } 
  } catch (e) {} 
}

function promptDeleteDaily() { handleDeletePrompt('Daily/Sunday', 'YYYY-MM-DD', 'daily', 'daily-archives.html'); }
function promptDeleteExam() { const ui = SpreadsheetApp.getUi(); const examRes = ui.prompt('Delete Exam', 'Enter Exam (gre, gmat):', ui.ButtonSet.OK_CANCEL); if (examRes.getSelectedButton() == ui.Button.OK) { handleDeletePrompt('Exam', 'YYYY-MM-DD', \\-weekly\, \\-archives.html\); } }
function promptDeleteWord() { handleDeletePrompt('Word', 'Word Slug (e.g. aberrant)', 'word', null); }
function handleDeletePrompt(t, f, prefix, aPath) { const ui = SpreadsheetApp.getUi(); const res = ui.prompt(\Delete \\, \\:\, ui.ButtonSet.OK_CANCEL); if (res.getSelectedButton() == ui.Button.OK) { let idx = res.getResponseText().trim().toLowerCase(); if(idx) { ui.alert(\Deleting...\); if(deleteFileFromGithub(\\/\.html\, true) && aPath) removeCardFromArchives(aPath, idx); } } }

function buildVaultPage(w) { 
  return \<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>\</title><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap" rel="stylesheet"><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-50 p-10 max-w-3xl mx-auto"><div class="bg-white p-10 rounded-3xl shadow-sm border"><h1 class="text-6xl font-black mb-6">\</h1><p class="text-xl text-gray-600 mb-8">\</p></div></body></html>\; 
}

function buildArchiveCard(d) {
  const tagsHtml = d.tags.map(tag => \<span class="px-3 py-1 bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600 rounded-lg text-xs font-bold uppercase tracking-wider">\</span>\).join("");
  return \
<!-- Card for \ \ -->
<article class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col md:flex-row mb-8 group transform hover:-translate-y-1">
  <div class="bg-[#0b1a2a] md:w-36 flex flex-col items-center justify-center p-8 text-white text-center shrink-0">
    <span class="text-xs font-bold uppercase tracking-widest text-[#FFD700] mb-1">\</span>
    <span class="text-4xl font-black tracking-tight">\</span>
    <span class="text-xs font-bold uppercase tracking-widest opacity-50 mt-2">\</span>
  </div>
  <div class="p-8 flex-1">
    <div class="flex items-center gap-3 mb-4">
      <span class="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 text-xs font-black rounded-full">\</span>
      <span class="text-xs font-bold uppercase tracking-widest text-gray-400">\</span>
    </div>
    <h3 class="text-2xl font-bold text-[#0b1a2a] mb-3 group-hover:text-blue-600 transition-colors"><a href="\" class="focus:outline-none before:absolute before:inset-0">\</a></h3>
    <p class="text-gray-600 mb-6 leading-relaxed font-medium">\</p>
    <div class="flex items-center gap-2 relative z-10">\</div>
  </div>
</article>\;
}

function promptWeeklyExamPublish() {
  const ui = SpreadsheetApp.getUi();
  const examRes = ui.prompt('Manual Publish', 'Exam Track (gre, gmat, ielts, toefl, sat, pte):', ui.ButtonSet.OK_CANCEL);
  if (examRes.getSelectedButton() == ui.Button.OK) {
    let ex = examRes.getResponseText().trim().toLowerCase();
    const batchRes = ui.prompt('Manual Publish', \Enter exact Batch_ID for \:\, ui.ButtonSet.OK_CANCEL);
    if (batchRes.getSelectedButton() == ui.Button.OK) {
       let bId = batchRes.getResponseText().trim();
       if (bId) {
           const ss = SpreadsheetApp.getActiveSpreadsheet();
           const data = ss.getSheetByName('Master_Vault').getDataRange().getValues();
           executeExamPublish(ex, bId, data, data[0].map(h => h.toString().trim().toLowerCase()), new Date());
           ui.alert(\? Published \ Batch \\);
       }
    }
  }
}

function buildSundayRecapPage(words, dateStr, batchIdText) {
  const siteUrl = CONFIG.SITE_URL; 
  let wordBoxes = words.map((w) => \
    <div class="bg-white border text-center border-gray-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-all group">
      <h3 class="text-2xl font-bold text-[#0b1a2a] mb-2 group-hover:text-blue-600 transition-colors">\</h3>
      <p class="text-sm text-gray-600 mb-4">\</p>
      <a href="\/word/\.html" class="text-xs font-bold uppercase tracking-wider text-blue-500 hover:underline">Review Details</a>
    </div>
  \).join("");

  return \<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sunday Recap: Batch \ | HowdyBuzz</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;900&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body { font-family: 'Outfit', sans-serif; }</style>
</head>
<body class="bg-gray-50 text-gray-800">
    <nav class="fixed top-0 w-full z-50 bg-[#0b1a2a] p-5 shadow-lg flex justify-between items-center">
        <a href="\" class="flex items-center gap-3">
            <span class="text-2xl font-bold text-white tracking-tight">Howdy<span class="text-[#FFD700]">Buzz</span></span>
        </a>
    </nav>
    <header class="pt-32 pb-20 px-6 bg-[#0b1a2a] text-white text-center">
        <span class="px-3 py-1 bg-white/10 text-gray-300 rounded-full text-xs font-bold uppercase tracking-widest border border-white/20 mb-6 inline-block">The Sunday Megadrop</span>
        <h1 class="text-5xl font-black mb-4">Batch \ <span class="text-[#FFD700]">Recap.</span></h1>
        <p class="text-xl text-gray-400">Lock in your learning. Review the words from this batch.</p>
    </header>
    <main class="max-w-5xl mx-auto px-6 py-16">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            \
        </div>
    </main>
</body>
</html>\;
}

function buildWeeklyExamPage(words, examKey, dateStr, batchIdText) {
  const siteUrl = CONFIG.SITE_URL; 
  const examNameUpper = examKey.toUpperCase();

  let wordList = words.map((w, index) => {
    let rawWordObj = {};
    for (const [key, value] of Object.entries(w)) { rawWordObj[key.toLowerCase()] = value; }
    const nuanceText = w[\\_Nuance\] || w[\\_Nuance\] || rawWordObj[\\_nuance\] || 'Focus on testing logic in context.';
    
    return \
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8 hover:shadow-md transition-all duration-300">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 class="text-3xl font-bold text-[#0b1a2a]">\</h2>
          <span class="inline-block mt-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider">
            Vocabulary
          </span>
        </div>
        <div class="text-right hidden md:block">
          <span class="text-6xl font-black text-gray-50 select-none">0\</span>
        </div>
      </div>
      
      <div class="space-y-6">
        <div class="bg-gray-50 p-5 rounded-xl border border-gray-100">
          <span class="font-bold text-gray-400 uppercase tracking-widest text-xs mb-2 block">Definition</span>
          <p class="text-lg text-gray-800 leading-relaxed">\</p>
        </div>

        <div class="flex items-start gap-4 p-5 rounded-xl border-l-4 border-l-blue-600 bg-white shadow-sm">
          <span class="text-blue-600 mt-1">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          </span>
          <div>
            <span class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">\ Testing Logic</span>
            <p class="text-base text-gray-700 leading-relaxed font-medium">\</p>
          </div>
        </div>
      </div>
    </div>
  \}).join("");

  return \<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>\ Review (Batch \) | HowdyBuzz</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;900&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body { font-family: 'Outfit', sans-serif; }</style>
</head>
<body class="bg-gray-100 text-gray-800 antialiased selection:bg-blue-600 selection:text-white">
    <nav class="fixed top-0 w-full z-50 bg-[#0b1a2a]/95 backdrop-blur-md p-5 shadow-lg flex justify-between items-center border-b border-white/10">
        <a href="\" class="flex items-center gap-3 group">
            <span class="text-2xl font-bold text-white tracking-tight group-hover:text-[#FFD700] transition-colors">Howdy<span class="text-[#FFD700]">Buzz</span></span>
        </a>
        <a href="\/\-archives.html" class="text-sm font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-widest">&larr; Back to Archives</a>
    </nav>

    <header class="pt-40 pb-20 px-6 bg-[#0b1a2a] text-white text-center relative overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-br from-blue-900/50 to-transparent"></div>
        <div class="relative z-10">
            <span class="inline-block px-4 py-1.5 bg-blue-500/20 text-blue-300 rounded-full text-xs font-bold uppercase tracking-widest border border-blue-500/30 mb-6">\ Preparation Track</span>
            <h1 class="text-5xl md:text-6xl font-black mb-6 tracking-tight">Batch \ <span class="text-[#FFD700]">Masterclass.</span></h1>
            <p class="text-xl text-gray-400 max-w-2xl mx-auto font-light">Precision, context, and semantic nuance for highly-tested \ vocabulary.</p>
        </div>
    </header>

    <main class="max-w-4xl mx-auto px-6 py-16">
        \
    </main>
</body>
</html>\;
}

function buildDaily5Page(words, day, dateStr) {
  const siteUrl = CONFIG.SITE_URL; 
  let wordList = words.map((w, index) => \
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 hover:shadow-md transition-all duration-300">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 class="text-3xl font-bold text-[#0b1a2a]">\</h2>
        </div>
        <div class="text-right hidden md:block">
          <span class="text-6xl font-black text-gray-50 select-none">0\</span>
        </div>
      </div>
      <div class="space-y-6">
        <div>
          <h4 class="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Definition</h4>
          <p class="text-lg text-gray-700 leading-relaxed">\</p>
        </div>
        <div class="bg-gray-50 rounded-xl p-5 border-l-4 border-[#FFD700]">
          <h4 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Master Sentence</h4>
          <p class="text-gray-800 italic font-medium">"\"</p>
        </div>
        <div class="pt-4 border-t border-gray-100">
           <a href="\/word/\.html" class="inline-flex items-center text-sm font-bold text-blue-600 hover:text-[#0b1a2a] transition-colors group">
             View Deep Analysis &rarr;
           </a>
        </div>
      </div>
    </div>
  \).join("");

  return \<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily 5 Words | HowdyBuzz</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;900&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body { font-family: 'Outfit', sans-serif; }</style>
</head>
<body class="bg-gray-50 text-gray-800 antialiased">
    <nav class="fixed top-0 w-full z-50 bg-[#0b1a2a] p-5 shadow-lg flex justify-between items-center">
        <a href="\" class="flex items-center gap-3">
            <span class="text-2xl font-bold text-white tracking-tight">Howdy<span class="text-[#FFD700]">Buzz</span></span>
        </a>
        <a href="\/daily-archives.html" class="text-gray-400 hover:text-white font-bold text-sm tracking-widest uppercase transition-colors">&larr; Archives</a>
    </nav>
    <header class="pt-32 pb-20 px-6 bg-[#0b1a2a] text-white text-center">
        <span class="px-3 py-1 bg-white/10 text-gray-300 rounded-full text-xs font-bold uppercase tracking-widest border border-white/20 mb-6 inline-block">Daily Habit</span>
        <h1 class="text-5xl font-black mb-4">Today's <span class="text-[#FFD700]">Drops.</span></h1>
        <p class="text-xl text-gray-400">\</p>
    </header>
    <main class="max-w-3xl mx-auto px-6 py-16 space-y-8">
        \
    </main>
</body>
</html>\;
}
