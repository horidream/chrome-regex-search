/*** CONSTANTS ***/
var DEFAULT_INSTANT_RESULTS = true;
var ERROR_COLOR = '#ff8989';
var WHITE_COLOR = 'transparent';
var ERROR_TEXT = "Content script was not loaded. Are you currently in the Chrome Web Store or in a chrome:// page? If you are, content scripts won't work here. If not, please wait for the page to finish loading or refresh the page.";
var SHOW_HISTORY_TITLE = "Show search history";
var HIDE_HISTORY_TITLE = "Hide search history";
var ENABLE_CASE_INSENSITIVE_TITLE = "Enable case insensitive search";
var DISABLE_CASE_INSENSITIVE_TITLE = "Disable case insensitive search";
var HISTORY_IS_EMPTY_TEXT = "Search history is empty.";
var CLEAR_ALL_HISTORY_TEXT = "Clear History";
var DEFAULT_CASE_INSENSITIVE = false;
var MAX_HISTORY_LENGTH = 30;
/*** CONSTANTS ***/

/*** VARIABLES ***/
var sentInput = false;
var processingKey = false;
var searchHistory = null;
var maxHistoryLength = MAX_HISTORY_LENGTH;
/*** VARIABLES ***/

/*** FUNCTIONS ***/
/* Validate that a given pattern string is a valid regex */
function isValidRegex(pattern) {
  try{
    var regex = new RegExp(pattern);
    return true;
  } catch(e) {
    return false;
  }
}

/* Send message to content script of tab to select next result */
function selectNext(){
  chrome.tabs.query({
    'active': true,
    'currentWindow': true
  },
  function(tabs) {
    if ('undefined' != typeof tabs[0].id && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        'message' : 'selectNextNode'
      });
    }
  });
}

/* Send message to content script of tab to select previous result */
function selectPrev(){
  chrome.tabs.query({
    'active': true,
    'currentWindow': true
  },
  function(tabs) {
    if ('undefined' != typeof tabs[0].id && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        'message' : 'selectPrevNode'
      });
    }
  });
}

/* Send message to pass input string to content script of tab to find and highlight regex matches */
function passInputToContentScript(){
  passInputToContentScript(false);
}

function passInputToContentScript(configurationChanged){
  if (!processingKey) {
    var regexString = document.getElementById('inputRegex').value;
    var inputElement = document.getElementById('inputRegex');
    
    if (!isValidRegex(regexString)) {
      inputElement.classList.remove('valid');
      inputElement.classList.add('invalid');
    } else {
      inputElement.classList.remove('invalid');
      inputElement.classList.add('valid');
    }
    
    chrome.tabs.query(
      { 'active': true, 'currentWindow': true },
      function(tabs) {
        if ('undefined' != typeof tabs[0].id && tabs[0].id) {
          processingKey = true;
          chrome.tabs.sendMessage(tabs[0].id, {
            'message' : 'search',
            'regexString' : regexString,
            'configurationChanged' : configurationChanged,
            'getNext' : true
          });
          sentInput = true;
        }
      }
    );
  }
}

function createHistoryLineElement(text) {
  var deleteEntrySpan = document.createElement('span');
  deleteEntrySpan.className = 'historyDeleteEntry'
  deleteEntrySpan.textContent = '\u2715';
  deleteEntrySpan.addEventListener('click', function() {
    for (var i = searchHistory.length - 1; i >= 0; i--) {
      if (searchHistory[i] == text) {
        searchHistory.splice(i, 1);
      }
    }
    chrome.storage.local.set({searchHistory: searchHistory});
    updateHistoryDiv();
  });
  var linkSpan = document.createElement('span');
  linkSpan.className = 'historyLink'
  linkSpan.textContent = text;
  linkSpan.addEventListener('click', function() {
    if (document.getElementById('inputRegex').value !== text) {
      document.getElementById('inputRegex').value = text;
      passInputToContentScript();
      document.getElementById('inputRegex').focus();
    }
  });
  var lineDiv = document.createElement('div');
  lineDiv.className = 'historyLine';
  lineDiv.appendChild(linkSpan);
  lineDiv.appendChild(deleteEntrySpan);
  return lineDiv;
}

function updateHistoryDiv() {
  var historyDiv = document.getElementById('history');
  if (historyDiv) {
    historyDiv.innerHTML = '';
    if (searchHistory.length == 0) {
      var span = document.createElement('span');
      span.className = 'historyIsEmptyMessage';
      span.textContent = HISTORY_IS_EMPTY_TEXT;
      historyDiv.appendChild(span);
    } else {
      for (var i = searchHistory.length - 1; i >= 0; i--) {
        historyDiv.appendChild(createHistoryLineElement(searchHistory[i]));
      }
      var clearButton = document.createElement('a');
      clearButton.href = '#';
      clearButton.type = 'button';
      clearButton.textContent = CLEAR_ALL_HISTORY_TEXT;
      clearButton.className = 'clearHistoryButton';
      clearButton.addEventListener('click', clearSearchHistory);
      historyDiv.appendChild(clearButton);
    }
  }
}

function addToHistory(regex) {
  if (regex && searchHistory !== null) {
    if (searchHistory.length == 0 || searchHistory[searchHistory.length - 1] != regex) {
      searchHistory.push(regex);
    }
    for (var i = searchHistory.length - 2; i >= 0; i--) {
      if (searchHistory[i] == regex) {
        searchHistory.splice(i, 1);
      }
    }
    if (searchHistory.length > maxHistoryLength) {
      searchHistory.splice(0, searchHistory.length - maxHistoryLength);
    }
    chrome.storage.local.set({searchHistory: searchHistory});
    updateHistoryDiv();
  }
}

function setHistoryVisibility(makeVisible) {
  document.getElementById('history').style.display = makeVisible ? 'block' : 'none';
  document.getElementById('show-history').title = makeVisible ? HIDE_HISTORY_TITLE : SHOW_HISTORY_TITLE;
  if(makeVisible) {
    document.getElementById('show-history').className = 'action-button selected';
  } else {
    document.getElementById('show-history').className = 'action-button';
  }
}

function setCaseInsensitiveElement() {
  var caseInsensitive = chrome.storage.local.get({'caseInsensitive':DEFAULT_CASE_INSENSITIVE},
  function (result) {
    document.getElementById('insensitive').title = result.caseInsensitive ? DISABLE_CASE_INSENSITIVE_TITLE : ENABLE_CASE_INSENSITIVE_TITLE;
    if(result.caseInsensitive) {
      document.getElementById('insensitive').className = 'action-button selected';
    } else {
      document.getElementById('insensitive').className = 'action-button';
    }
  });

}
function toggleCaseInsensitive() {
  var caseInsensitive = document.getElementById('insensitive').className.includes('selected');
  document.getElementById('insensitive').title = caseInsensitive ? ENABLE_CASE_INSENSITIVE_TITLE : DISABLE_CASE_INSENSITIVE_TITLE;
  if(caseInsensitive) {
    document.getElementById('insensitive').className = 'action-button';
  } else {
    document.getElementById('insensitive').className = 'action-button selected';
  }
  sentInput = false;
  chrome.storage.local.set({caseInsensitive: !caseInsensitive});
  passInputToContentScript(true);
}

function clearSearchHistory() {
  searchHistory = [];
  chrome.storage.local.set({searchHistory: searchHistory});
  updateHistoryDiv();
}

// Function to clear search and remove highlights
function clearSearch() {
  sentInput = false;
  var inputElement = document.getElementById('inputRegex');
  inputElement.value = '';
  inputElement.classList.remove('invalid');
  inputElement.classList.remove('valid');
  
  // Send empty search to content script to clear highlights
  chrome.tabs.query(
    { 'active': true, 'currentWindow': true },
    function(tabs) {
      if ('undefined' != typeof tabs[0].id && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          'message': 'search',
          'regexString': '',
          'configurationChanged': true,
          'getNext': false
        });
      }
    }
  );
  
  inputElement.focus();
}

/*** LISTENERS ***/
document.getElementById('next').addEventListener('click', function() {
  selectNext();
});

document.getElementById('prev').addEventListener('click', function() {
  selectPrev();
});

document.getElementById('clear').addEventListener('click', function() {
  clearSearch();
});

document.getElementById('show-history').addEventListener('click', function() {
  var makeVisible = document.getElementById('history').style.display == 'none';
  setHistoryVisibility(makeVisible);
  chrome.storage.local.set({isSearchHistoryVisible: makeVisible});
});

document.getElementById('insensitive').addEventListener('click', function() {
  toggleCaseInsensitive();
});

document.getElementById('copy-to-clipboard').addEventListener('click', function () {
  chrome.tabs.query({
      'active': true,
      'currentWindow': true
    },
    function (tabs) {
      if ('undefined' != typeof tabs[0].id && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          'message': 'copyToClipboard'
        });
      }
    });
});

/* Received returnSearchInfo message, populate popup UI */ 
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if ('returnSearchInfo' == request.message) {
    processingKey = false;
    if (request.numResults > 0) {
      document.getElementById('numResults').textContent = String(request.currentSelection+1) + ' of ' + String(request.numResults);
    } else {
      document.getElementById('numResults').textContent = String(request.currentSelection) + ' of ' + String(request.numResults);
    }
    if (!sentInput) {
      document.getElementById('inputRegex').value = request.regexString;
    }
    if (request.numResults > 0 && request.cause == 'selectNode') {
      addToHistory(request.regexString);
    }
    if (request.regexString !== document.getElementById('inputRegex').value) {
      passInputToContentScript();
    }
  }
});

/* Key listener for selectNext and selectPrev
 * Thanks a lot to Cristy from StackOverflow for this AWESOME solution
 * http://stackoverflow.com/questions/5203407/javascript-multiple-keys-pressed-at-once */
var map = [];
onkeydown = onkeyup = function(e) {
    map[e.keyCode] = e.type == 'keydown';
    
    // If Escape key is pressed, clear the search
    if (e.type == 'keydown' && e.keyCode == 27) { // ESC key
      if(e.ctrlKey) {
        console.log("ESC key pressed, clearing search");
        clearSearch();
        e.preventDefault(); // Prevent default ESC behavior
        return;
      } else {
        clearSearch();
        window.close(); // Close the popup
		    e.preventDefault();
		    return;
      }
    }
    
    // If Cmd+Shift+F (Mac) or Ctrl+Shift+F (Windows/Linux) is pressed, close the popup
    if (e.type == 'keydown' && e.keyCode == 70 && e.shiftKey && (e.metaKey || e.ctrlKey)) { // F key with Shift and (Cmd or Ctrl)
      console.log("Cmd/Ctrl+Shift+F pressed, closing popup");
      clearSearch();
      window.close(); // Close the popup
      e.preventDefault();
      return;
    }
    
    // If Alt+C is pressed, toggle case sensitivity
    if (map[18] && map[67]) { // ALT + C
      toggleCaseInsensitive();
      return;
    }
    
    if (document.getElementById('inputRegex') === document.activeElement) { //input element is in focus
      if (!map[16] && map[13]) { //ENTER
        if (sentInput) {
          selectNext();
        } else {
          passInputToContentScript();
        }
      } else if (map[16] && map[13]) { //SHIFT + ENTER
        selectPrev();
      }
    }
}
/*** LISTENERS ***/

/*** INIT ***/
/* Retrieve from storage whether we should use instant results or not */
chrome.storage.local.get({
    'instantResults' : DEFAULT_INSTANT_RESULTS,
    'maxHistoryLength' : MAX_HISTORY_LENGTH,
    'searchHistory' : null,
    'isSearchHistoryVisible' : false},
  function(result) {
    if(result.instantResults) {
      document.getElementById('inputRegex').addEventListener('input', function() {
        passInputToContentScript();
      });
    } else {
      document.getElementById('inputRegex').addEventListener('change', function() {
        passInputToContentScript();
      });
    }
    console.log(result);
    if(result.maxHistoryLength) {
      maxHistoryLength = result.maxHistoryLength;
    }
    if(result.searchHistory) {
      searchHistory = result.searchHistory.slice(0);
    } else {
      searchHistory = [];
    }
    setHistoryVisibility(result.isSearchHistoryVisible);
    updateHistoryDiv();
  }
);

/* Get search info if there is any */
chrome.tabs.query({
  'active': true,
  'currentWindow': true
},
function(tabs) {
  if ('undefined' != typeof tabs[0].id && tabs[0].id) {
    chrome.tabs.sendMessage(tabs[0].id, {
      'message' : 'getSearchInfo'
    }, function(response){
      if (chrome.runtime.lastError) {
        // Handle the error case
        console.log('Content script not loaded:', chrome.runtime.lastError.message);
        var errorElement = document.getElementById('error');
        errorElement.textContent = ERROR_TEXT;
        errorElement.style.display = 'block';
      } else if (response) {
        // Content script is active and responded
        console.log('Content script response:', response);
      }
    });
  }
});

/* Focus onto input form */
document.getElementById('inputRegex').focus();
window.setTimeout( 
  function(){document.getElementById('inputRegex').select();}, 0);
//Thanks to http://stackoverflow.com/questions/480735#comment40578284_14573552

var makeVisible = document.getElementById('history').style.display == 'none';
setHistoryVisibility(makeVisible);
chrome.storage.local.set({isSearchHistoryVisible: makeVisible});

setCaseInsensitiveElement();
/*** INIT ***/

