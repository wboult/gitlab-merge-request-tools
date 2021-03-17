function waitForElm(selector) {
  return new Promise(resolve => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver(mutations => {
      if (document.querySelector(selector)) {
        resolve(document.querySelector(selector));
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

const sidePanelSelector = ".issuable-context-form"
const fileDiffSelector = ".diff-files-holder"
const linesChangedSelector = ".diff-stats-group"
const treeViewSelector = ".tree-list-scroll"

waitForElm(sidePanelSelector).then(_ => initialiseControls());
waitForElm(fileDiffSelector).then(_ => getFileInformation());
waitForElm(linesChangedSelector).then(_ => storeTotalLinesChanged());

const fileInformation = [];
const loadedFiles = {};
const fullFileTree = {
  files: [],
  dirs: {}
};
let totalAdded;
let currentLinesAdded;
let currentLinesDeleted;
let totalLinesDeleted;
let totalFiles;
let totalDeletedFiles = 0;
let totalRenamedFiles = 0;

function storeTotalLinesChanged() {
  totalAdded = $(linesChangedSelector).find(".js-file-addition-line").first().text() * 1;
  totalLinesDeleted = $(linesChangedSelector).find(".js-file-deletion-line").first().text() * 1;
  totalFiles = parseInt($(linesChangedSelector).find(".text-secondary.bold").first().text(), 10);
}

function getFileInformation() {
  $(".diff-files-holder").children().each(function (_, file) {
    if (
      file.getElementsByClassName("js-file-deletion-line").length > 0 &&
      file.getElementsByClassName("js-file-addition-line").length > 0 &&
      file.getAttribute("data-path")
    ) {
      const linesAdded = file.getElementsByClassName("js-file-addition-line")[0].innerText * 1;
      const linesDeleted = file.getElementsByClassName("js-file-deletion-line")[0].innerText * 1;
      const filePath = file.getAttribute("data-path");
      const fileName = file.getAttribute("data-path").split("/").slice(-1)[0];
      if (!loadedFiles[filePath]) {
        loadedFiles[filePath] = "loaded";
        fileInformation.push({
          filePath: filePath,
          fileName: fileName,
          linesAdded: linesAdded,
          linesDeleted: linesDeleted
        });
        if (linesDeleted > 0 && linesAdded === 0) {
          totalDeletedFiles = totalDeletedFiles + 1;
          const checkboxLabel = $("label[for='exclude-deleted-files']");
          const children = checkboxLabel.children();
          checkboxLabel
            .text("Exclude " + totalDeletedFiles + " deleted files")
            .append(children)
            .show();
        }
        if (linesDeleted === 0 && linesAdded === 0) {
          totalRenamedFiles = totalRenamedFiles + 1;
          const checkboxLabel = $("label[for='exclude-renamed-files']")
          const children = checkboxLabel.children();
          checkboxLabel
            .text("Exclude " + totalRenamedFiles + " renamed files")
            .append(children)
            .show();
        }
      }
    }
  });

  setTimeout(getFileInformation, 1000);
}

function initialiseControls() {
  $(sidePanelSelector).prepend(`
      <div class="block">
          <div data-testid="file-filters">
              <div title="File filters" class="sidebar-collapsed-icon">
                  <svg class="gl-icon s16">
                      <use
                          href="https://gitlab.com/assets/icons-d792042867af78bc238955dff191e163673be846609553c7e073bfd64aaf2549.svg#search">
                      </use>
                  </svg>
              </div>
          </div>
          <div class="hide-collapsed">
              <label>
                  Include files
                  <input id="include-file-filter-patternx" type="text" placeholder="File pattern..." class="form-control"></input>
              </label>
              <label>
                  Exclude files
                  <input id="exclude-file-filter-patternx" type="text" placeholder="File pattern..." class="form-control"></input>
              </label>
              <label for="exclude-deleted-files" style="display: none">
                  Exclude deleted files
                  <input id="exclude-deleted-files" type="checkbox" style="margin-left: 10px"></input>
              </label>
              <label for="exclude-renamed-files" style="display: none">
                  Exclude renamed files
                  <input id="exclude-renamed-files" type="checkbox" style="margin-left: 10px"></input>
              </label>
              <br>
              <button id="apply-file-filters" class="btn btn-default">Apply</button>
              <button id="clear-filters" class="btn btn-default" disabled>Clear Filters</button>
          </div>
    </div>
  `);

  function escapeRegex(string) {
    return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  }


  $("#clear-filters").click(function () {
    $("#include-file-filter-patternx").val(undefined);
    $("#exclude-file-filter-patternx").val(undefined);
    $("#exclude-deleted-files").prop('checked', false);
    $("#exclude-renamed-files").prop('checked', false);
    applyFilter();
    $("#clear-filters").prop('disabled', true);
  });

  function applyFilter() {
    storeFileTree();
    currentLinesAdded = totalAdded;
    currentLinesDeleted = totalLinesDeleted;
    currentFiles = totalFiles;
    const includePattern = $("#include-file-filter-patternx").val();
    const excludePattern = $("#exclude-file-filter-patternx").val();
    const excludeDeletedFiles = $("#exclude-deleted-files").prop('checked');
    const excludeRenamedFiles = $("#exclude-renamed-files").prop('checked');

    if (includePattern || excludePattern || excludeDeletedFiles || excludeRenamedFiles) {
      $("#clear-filters").prop('disabled', false);
    }

    let includeRegex;
    let excludeRegex;
    if (includePattern) {
      const pattern = escapeRegex(includePattern).replaceAll("\\*", ".*");
      includeRegex = new RegExp(`.*${pattern}.*`);
    }

    if (excludePattern) {
      const pattern = escapeRegex(excludePattern).replaceAll("\\*", ".*");
      excludeRegex = new RegExp(`.*${pattern}.*`);
    }

    const options = {
      includeRegex: includeRegex,
      excludeRegex: excludeRegex,
      excludeDeletedFiles: excludeDeletedFiles,
      excludeRenamedFiles: excludeRenamedFiles
    };

    fileInformation.forEach(fileInfo => {
      let fileHidden = false;
      if (excludeDeletedFiles && fileInfo.linesAdded === 0 && fileInfo.linesDeleted > 0) {
        if (!fileHidden) {
          currentFiles = currentFiles - 1;
        }
        fileHidden = true;
      }
      if (excludeRenamedFiles && fileInfo.linesAdded === 0 && fileInfo.linesDeleted === 0) {
        if (!fileHidden) {
          currentFiles = currentFiles - 1;
        }
        fileHidden = true;
      }
      if (includeRegex && !includeRegex.test(fileInfo.filePath)) {
        if (!fileHidden) {
          currentFiles = currentFiles - 1;
        }
        fileHidden = true;
      }
      if (excludeRegex && excludeRegex.test(fileInfo.filePath)) {
        if (!fileHidden) {
          currentFiles = currentFiles - 1;
        }
        fileHidden = true;
      }
      if (fileHidden) {
        $(`div[data-path='${fileInfo.filePath}']`).hide();
        currentLinesAdded = currentLinesAdded - fileInfo.linesAdded;
        currentLinesDeleted = currentLinesDeleted - fileInfo.linesDeleted;
      } else {
        $(`div[data-path='${fileInfo.filePath}']`).show();
      }
    });

    treeHide(fullFileTree, options, "", []);

    const additionLine = $(linesChangedSelector).find(".js-file-addition-line").first();
    const deletionLine = $(linesChangedSelector).find(".js-file-deletion-line").first();
    const filesChanged = $("#diffs-tab").find(".badge.badge-pill").first();
    const filesChanged2 =  $(linesChangedSelector).find(".text-secondary.bold").first();

    additionLine.text(currentLinesAdded).addClass("ping");
    deletionLine.text(currentLinesDeleted).addClass("ping");
    filesChanged.text(currentFiles).addClass("ping");
    filesChanged2.text(currentFiles + " files").addClass("ping");
    
    setTimeout(_ => {
      additionLine.removeClass("ping");
      deletionLine.removeClass("ping");
      filesChanged.removeClass("ping");
      filesChanged2.removeClass("ping");
    }, 1000);
  }

  $("#apply-file-filters").click(applyFilter);
}

function treeHide(tree, options, parentDir, parentTrees) {
  const includeRegex = options.includeRegex;
  const excludeRegex = options.excludeRegex;
  const excludeDeletedFiles = options.excludeDeletedFiles;
  const excludeRenamedFiles = options.excludeRenamedFiles;

  tree.visibleFilesThisLevel = 0;
  tree.files.forEach(f => {
    const fullFilePath = `${parentDir}${f.name}`;
    f.fileHidden = false;
    if (excludeDeletedFiles && f.linesAdded === 0 && f.linesDeleted > 0) {
      f.fileHidden = true;
    }
    if (excludeRenamedFiles && f.linesAdded === 0 && f.linesDeleted === 0) {
      f.fileHidden = true;
    }
    if (includeRegex && !includeRegex.test(fullFilePath)) {
      f.fileHidden = true;
    }
    if (excludeRegex && excludeRegex.test(fullFilePath)) {
      f.fileHidden = true;
    }
    if (!f.fileHidden) {
      tree.visibleFilesThisLevel = tree.visibleFilesThisLevel + 1;
      parentTrees.forEach(pt => {
        pt.visibleFilesThisLevel = pt.visibleFilesThisLevel + 1;
      });
    }
  });
  for (let dir in tree.dirs) {
    if (tree.dirs.hasOwnProperty(dir)) {
      const level = tree.dirs[dir];
      treeHide(level, options, `${dir}/`, [...parentTrees, level]);
    }
  }
  hideDir(tree);
}

function hideDir(tree) {
  tree.files.forEach(f => {
    if (f.fileHidden) {
      $(f.ref).hide();
    } else {
      $(f.ref).show();
    }
  });
  if (tree.ref) {
    if (!tree.collapsed && tree.visibleFilesThisLevel == 0) {
      $(tree.ref).hide();
    } else {
      $(tree.ref).show();
    }
    for (let dir in tree.dirs) {
      if (tree.dirs.hasOwnProperty(dir)) {
        const level = tree.dirs[dir];
        hideDir(level);
      }
    }
  }
}

function storeFileTree() {
  $(treeViewSelector).children().each(function (_, topLevelDirectory) {
    treeRecurse(fullFileTree, topLevelDirectory, []);
  });

  fixTruncatedPaths(fullFileTree);
}

function fixTruncatedPaths(tree) {
  for (let dir in tree.dirs) {
    if (tree.dirs.hasOwnProperty(dir) && dir.includes("/…/")) {
      const nested = tree.dirs[dir];
      const nestedFullDir = getFirstFullPath(nested);
      if (nestedFullDir) {
        let fullDir = "";
        const truncSplitter = RegExp("(\/…)+\/");
        const [, , end] = dir.split(truncSplitter);
        const pathSections = nestedFullDir.split("/");
        for (let index = 0; index < pathSections.length; index++) {
          const pathSection = pathSections[index];
          fullDir = `${fullDir}${pathSection}/`;
          if (pathSection === end) {
            break;
          }
        }
        if (fullDir !== dir) {
          Object.defineProperty(
            tree.dirs,
            fullDir,
            Object.getOwnPropertyDescriptor(tree.dirs, dir)
          );
          delete tree.dirs[dir];
          fixTruncatedPaths(tree.dirs[fullDir]);
        }
      } else {
        fixTruncatedPaths(nested);
      }
    }
  }
}

function getFirstFullPath(treeObject) {
  let firstFullPath;
  for (let dir in treeObject.dirs) {
    if (treeObject.dirs.hasOwnProperty(dir)) {
      if (dir.includes("/") && !dir.includes("/.../")) {
        firstFullPath = dir;
        break;
      } else {
        firstFullPath = getFirstFullPath(treeObject.dirs[dir]);
      }
    }
  }

  return firstFullPath;
}

function treeRecurse(treeObject, levelElement, parentDirs) {
  let dirName = [...parentDirs, levelElement.firstChild.firstChild.getAttribute("data-qa-file-name")].join("/");

  const children = Array.from(levelElement.children);

  const dirInformation = {
    files: [],
    dirs: {},
    ref: levelElement,
    collapsed: false
  };

  if (children.length == 1) {
    // Top level file 
    if (!children[0].classList.contains("folder")) {
      treeObject.files.push(getFileDetails(children[0]));
      return;
    } else {
      // collapsed directory
      dirInformation.collapsed = true;
      treeObject.dirs[dirName] = dirInformation;
      return;
    }
  }

  const fullDirName = children.shift().title;
  if (fullDirName) {
    dirName = fullDirName;
  }

  treeObject.dirs[dirName] = dirInformation;

  const fileChildren = children.filter(c => {
    return c.firstChild.firstChild.children.length == 3;
  }).map(getFileDetails);

  treeObject.dirs[dirName].files = fileChildren;

  const directoryChildren = children.filter(c => {
    return c.firstChild.firstChild.children.length == 2;
  })
  
  directoryChildren.forEach(d => {
    return treeRecurse(treeObject.dirs[dirName], d, [...parentDirs, dirName]);
  });
}

function getFileDetails(element) {
  const fileName = element.firstChild.firstChild.getAttribute("data-qa-file-name");
  const linesAdded = element.querySelector(".cgreen").innerText * 1;
  const linesDeleted = Math.abs(element.querySelector(".cred").innerText * 1);
  return {
    name: fileName,
    linesAdded: linesAdded,
    linesDeleted: linesDeleted,
    ref: element
  };
}
