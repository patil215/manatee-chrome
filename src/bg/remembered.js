function RememberedGrades() {
    this.manaTEAMS = new ManaTEAMS('', '');
}

// TODO: how do I know if they are in progress of getting new grades?
// TODO: consistent names for grades, courses, cycleObj, cycleClass, cycleClassGrades, etc.
// TODO: way to refresh the fetch in case of failure

RememberedGrades.prototype.login = function(username, password, success, error) {
    this.manaTEAMS = new ManaTEAMS(username, password);
    thisinstance = this;
    this.manaTEAMS.login(success, error);
};

RememberedGrades.prototype.loginCache = function(success, error) {
    var thisinstance = this;
    chrome.storage.local.get(['username', 'password'], function(item) {
        if ('username' in item && 'password' in item) {
            thisinstance.login(item.username, item.password, function() {
				chrome.storage.local.set({'loggedin': true});
				success();
			}, function(data) {
				chrome.storage.local.set({'loggedin': false});
				error(data);
			});
        } else {
			chrome.storage.local.set({'loggedin': false});
            error('no cached credentials');
        }
    });
};

RememberedGrades.prototype.updateCache = function(username, password, success, error) {
    chrome.storage.local.set({
        'password': password,
        'username': username
    });
    this.login(username, password, success, error);
};

RememberedGrades.prototype.loggedInCache = function(callback) {
	chrome.storage.local.get('loggedin', function(item) {
		if ('loggedin' in item) {
			callback(item.loggedin);
		} else {
			callback(false);
		}
	});
};

RememberedGrades.prototype.updateGrades = function(callback) {
    // TODO: what if manateams fail
    var thisinstance = this;
    this.manaTEAMS.login(function(selectInfo) {
        thisinstance.manaTEAMS.getAllCourses(function(averagesHtml, courses) {
            // TODO: delete unused/duplicated properties
            for (var i = 0; i < courses.length; ++i) {
                // console.log('course ' + (i + 1) + ' of ' + courses.length);
                courses[i].allCycles = [];
                courseId = courses[i].courseId;
                for (var j = 0; j < courses[i].semesters.length; ++j) {
                    // console.log('semester ' + (j + 1) + ' of ' + courses[i].semesters.length);
                    for (var k = 0; k < courses[i].semesters[j].cycles.length; ++k) {
                        // console.log('cycle ' + (k + 1) + ' of ' + courses[i].semesters[j].cycles.length);
                        courses[i].semesters[j].cycles[k].courseId = courseId;
                        courses[i].semesters[j].cycles[k].semesterId = j;
                        courses[i].semesters[j].cycles[k].cycleId = k;
                        // the following stores a copy of courses[i].semesters[j].cycles[k] and puts in allCycles array
                        courses[i].allCycles.push($.extend(true, {}, courses[i].semesters[j].cycles[k]));
                        courses[i].time = Date.now();
                    }
                }
            }
            chrome.storage.local.set({
                'averagesHtml': averagesHtml,
                'courses': courses
            });
            callback(courses);
        });
    });
};

RememberedGrades.prototype.updateAll = function(callback) {
    var thisinstance = this;
    this.updateGrades(function(courses) {
        for (var i = 0; i < courses.length; ++i) {
            for (var j = 0; j < courses[i].semesters.length; ++j) {
                for (var k = 0; k < courses[i].semesters[j].cycles.length; ++k) {
                    thisinstance.updateCycleGrades(courses[i].courseId, j, k, function(f) {
                        callback();
                    });
                }
            }
        }
    });
};

RememberedGrades.prototype.updateCycleGrades = function(course, semester, cycle, callback) {
    var thisinstance = this;
    // TODO: used cached averages html
    this.manaTEAMS.login(function(selectInfo) {
        thisinstance.manaTEAMS.getAllCourses(function(html, courses) {
			console.log('12');
            thisinstance.manaTEAMS.getCycleClassGrades(course, cycle, semester, html, function(cycleGrades) {
				console.log(cycleGrades);
				console.log('13');
                chrome.storage.local.get(['cycleObj'], function(item) {
					console.log('14');
					time = (new Date()).toTimeString();
					$.extend(true, {'time': time}, cycleGrades, cycleGrades);
                    var newCycleObj = {};
                    newCycleObj[course] = {};
                    newCycleObj[course][semester] = {};
                    newCycleObj[course][semester][cycle] = cycleGrades;
                    $.extend(true, newCycleObj, item.cycleObj, newCycleObj);
                    // TODO: when RememberedGrades.updateCycleGrades is called from
                    //       loop (as in RememberedGrades.updateAll), do this once at the
                    //       end, rather than every iteration
                    chrome.storage.local.set({
                        'cycleObj': newCycleObj
                    });
					console.log(newCycleObj);
					console.log(cycleGrades);
                    // TODO: make this add to courses.allcycles instead of cycleObj
                    callback(cycleGrades);
                });
            });
        });
    });
};

RememberedGrades.prototype.getGrades = function(callback) {
    var thisinstance = this;
    chrome.storage.local.get('courses', function(item) {
        grades = item.courses;
        if (grades) {
            callback(grades, false); // callback immediately with old data, if possible
        }
    });
    thisinstance.updateGrades(function(grades) {
        callback(grades, true); // callback later with new data
    });
};

RememberedGrades.prototype.getCycleGrades = function(course, semester, cycle, callback) {
	console.log('1');
    chrome.storage.local.get(['cycleObj'], function(item) {
		if ('cycleObj' in item) {
			cycleGrades = item.cycleObj[course][semester][cycle];
			if (cycleGrades) {
				console.log('3a');
				callback(cycleGrades, false); // callback immediately with old data, if possible
			}
		}
    });
	console.log('4');
    this.updateCycleGrades(course, semester, cycle, function(cycleGrades) {
		console.log('5');
		console.log(cycleGrades);
        callback(cycleGrades, true);
    }); // callback later with new data
};

RememberedGrades.prototype.logout = function(callback) {
    // TODO: clear cookies
    chrome.storage.local.clear(function() {
        updateCredentials('', '');
        callback();
    });
};
