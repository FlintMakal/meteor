// Client-side JavaScript, bundled and sent to client.

// Define Minimongo collections to match server/publish.js.
Lists = new Meteor.Collection("lists");
Todos = new Meteor.Collection("todos");

// ID of currently selected list
Session.set('list_id', null);

// Name of currently selected tag for filtering
Session.set('tag_filter', null);

// When adding tag to a todo, ID of the todo
Session.set('editing_addtag', null);

// When editing a list name, ID of the list
Session.set('editing_listname', null);

// When editing todo text, ID of the todo
Session.set('editing_itemname', null);

// When editing todo duedate, ID of the todo
Session.set('editing_itemduedate', null);


// Subscribe to 'lists' collection on startup.
// Select a list once data has arrived.
Meteor.subscribe('lists');

// Always be subscribed to the todos for the selected list or no list.
Meteor.autosubscribe(function () {
  var list_id = Session.get('list_id');
  Meteor.subscribe('todos', list_id);
});


////////// Helpers for in-place editing //////////

// Returns an event_map key for attaching "ok/cancel" events to
// a text input (given by selector)
var okcancel_events = function (selector) {
  return 'keyup '+selector+', keydown '+selector+', focusout '+selector;
};

// Creates an event handler for interpreting "escape", "return", and "blur"
// on a text field and calling "ok" or "cancel" callbacks.
var make_okcancel_handler = function (options) {
  var ok = options.ok || function () {};
  var cancel = options.cancel || function () {};
  //console.log(evt);
  return function (evt) {
    if (evt.type === "keydown" && evt.which === 27) {
      // escape = cancel
      cancel.call(this, evt);

    } else if (evt.type === "keyup" && evt.which === 13 ||
               evt.type === "focusout") {
      // blur/return/enter = ok/submit if non-empty
      var value = String(evt.target.value || "");
      
      if (value)
        ok.call(this, value, evt);
      else
        cancel.call(this, evt);
    }
  };
};

// Finds a text input in the DOM by id and focuses it.
var focus_field_by_id = function (id) {
  var input = document.getElementById(id);
  if (input) {
    input.focus();
    input.select();
  }
};

////////// Lists //////////

Template.lists.lists = function () {
  return Lists.find({}, {sort: {name: 1}});
};
Template.lists.count = function () {
  return Todos.find({list_id: this._id}).count();
};

Template.lists.events = {
  'mousedown .list': function (evt) { // select list
    if(!this._id)
      Session.set('list_id', null);
    
    Router.setList(this._id);      
  },
  'dblclick .list': function (evt) { // start editing list name
    Session.set('editing_listname', this._id);
    Meteor.flush(); // force DOM redraw, so we can focus the edit field
    focus_field_by_id("list-name-input");
  },
  'click .destroy': function () {
    Lists.remove(this._id);
    Todos.remove({list_id: this._id});
  },
};

Template.lists.events[ okcancel_events('#list-name-input') ] =
  make_okcancel_handler({
    ok: function (value) {
      Lists.update(this._id, {$set: {name: value}});
      Session.set('editing_listname', null);
    },
    cancel: function () {
      Session.set('editing_listname', null);
    }
  });

// Attach events to keydown, keyup, and blur on "New list" input box.
Template.lists.events[ okcancel_events('#new-list') ] =
  make_okcancel_handler({
    ok: function (text, evt) {
      var id = Lists.insert({name: text});
      Router.setList(id);
      evt.target.value = "";
    }
  });

Template.lists.selected = function () {
  if(Session.get('list_id'))
    return Session.equals('list_id', this._id) ? 'selected' : '';
  else
    return this._id==undefined ? 'selected' : '';
};

Template.lists.name_class = function () {
  return this.name ? '' : 'empty';
};

Template.lists.editing = function () {
  return Session.equals('editing_listname', this._id);
};

////////// Todos //////////

Template.todos.any_list_selected = function () {
  return !Session.equals('list_id', null);
};

Template.todos.events = {
  'mousedown .duedate': function () {
    $("#new-duedate").datepicker(); 
  }
};

Template.todos.events[ okcancel_events('#new-todo') ] =
  make_okcancel_handler({
    ok: function (text, evt) {
      //console.log(Date.UTC(duedate));
      var duedate = document.getElementById('new-duedate').value;
      var tag = Session.get('tag_filter');
      Todos.insert({
        text: text,
        list_id: Session.get('list_id'),
        done: false,
        timestamp: (new Date()).getTime(),
        tags: tag ? [tag] : [],
        due_date: Date.parse(duedate)
      });
      evt.target.value = '';
      document.getElementById('new-duedate').value = '';
    }
  });

  
    

Template.todos.todos = function () {
  // Determine which todos to display in main pane,
  // selected based on list_id and tag_filter.

  var sel = {};
  
  if(Session.get('list_id'))
    var list_id = {list_id: Session.get('list_id')};
  
  if (list_id)
    sel = list_id;

  var tag_filter = Session.get('tag_filter');
  
  if (tag_filter)
    sel.tags = tag_filter;

  return Todos.find(sel, {sort: {due_date: 1}});
};


Template.todo_item.tag_objs = function () {
  var todo_id = this._id;
  return _.map(this.tags || [], function (tag) {
    return {todo_id: todo_id, tag: tag};
  });
};

Template.todo_item.done_class = function () {
  return this.done ? 'done' : '';
};

Template.todo_item.done_checkbox = function () {
  return this.done ? 'checked="checked"' : '';
};

Template.todo_item.editing_itemname = function () {
  return Session.equals('editing_itemname', this._id);
};

Template.todo_item.editing_itemduedate = function () {
  return Session.equals('editing_itemduedate', this._id);
};

Template.todo_item.adding_tag = function () {
  return Session.equals('editing_addtag', this._id);
};

Template.todo_item.list_name = function () {
  //console.log(this.list_id);
  return !Session.get('list_id', this.list_id) ? Lists.findOne({_id: this.list_id}).name+' - ' : '';
};

Template.todo_item.due_date = function () {
  //console.log(this.list_id);
  return Todos.findOne({_id: this._id}).due_date ? moment(Todos.findOne({_id: this._id}).due_date).format("ddd D MMM YYYY") : '';
};

Template.todo_item.events = {
  'click .check': function () {
    Todos.update(this._id, {$set: {done: !this.done}});
  },

  'click .destroy': function () {
    Todos.remove(this._id);
  },

  'click .addtag': function (evt) {
    Session.set('editing_addtag', this._id);
    Meteor.flush(); // update DOM before focus
    focus_field_by_id("edittag-input");
  },

  'dblclick .display .todo-text': function (evt) {
    Session.set('editing_itemname', this._id);
    Meteor.flush(); // update DOM before focus
    focus_field_by_id("todo-input");
  },

  'dblclick .display .todo-duedate': function (evt) {
    Session.set('editing_itemduedate', this._id);
    Meteor.flush(); // update DOM before focus
    $("#todo-duedate").datepicker();
    focus_field_by_id("todo-duedate");
  },

  'click .remove': function (evt) {
    var tag = this.tag;
    var id = this.todo_id;

    evt.target.parentNode.style.opacity = 0;
    // wait for CSS animation to finish
    Meteor.setTimeout(function () {
      Todos.update({_id: id}, {$pull: {tags: tag}});
    }, 300);
  }

};

Template.todo_item.events[ okcancel_events('#todo-input') ] =
  make_okcancel_handler({
    ok: function (value) {
      Todos.update(this._id, {$set: {text: value}});
      Session.set('editing_itemname', null);
    },
    cancel: function () {
      Session.set('editing_itemname', null);
    }
  });

  Template.todo_item.events[ okcancel_events('#todo-duedate') ] =
  make_okcancel_handler({
    ok: function (value) {
      Todos.update(this._id, {$set: {due_date: value}});
      Session.set('editing_itemduedate', null);
    },
    cancel: function () {
      Session.set('editing_itemduedate', null);
    }
  });

Template.todo_item.events[ okcancel_events('#edittag-input') ] =
  make_okcancel_handler({
    ok: function (value) {
      Todos.update(this._id, {$addToSet: {tags: value}});
      Session.set('editing_addtag', null);
    },
    cancel: function () {
      Session.set('editing_addtag', null);
    }
  });

////////// Tag Filter //////////

// Pick out the unique tags from all todos in current list.
Template.tag_filter.tags = function () {
  var tag_infos = [];
  var total_count = 0;

  if(Session.get('list_id'))
    Todos.find({list_id: Session.get('list_id')}).forEach(function (todo) {
      _.each(todo.tags, function (tag) {
        var tag_info = _.find(tag_infos, function (x) { return x.tag === tag; });
        if (! tag_info)
          tag_infos.push({tag: tag, count: 1});
        else
          tag_info.count++;
      });
      total_count++;
    });
  else
    Todos.find().forEach(function (todo) {
      _.each(todo.tags, function (tag) {
        var tag_info = _.find(tag_infos, function (x) { return x.tag === tag; });
        if (! tag_info)
          tag_infos.push({tag: tag, count: 1});
        else
          tag_info.count++;
      });
      total_count++;
    });

  tag_infos = _.sortBy(tag_infos, function (x) { return x.tag; });
  tag_infos.unshift({tag: null, count: total_count});
  return tag_infos;
};

Template.tag_filter.tag_text = function () {
  //console.log(this.tag);
  return this.tag || "All items";
};

Template.tag_filter.selected = function () {
  return Session.equals('tag_filter', this.tag) ? 'selected' : '';
};

Template.tag_filter.events = {
  'mousedown .tag': function () {
    if (Session.equals('tag_filter', this.tag))
      Session.set('tag_filter', null);
    else
      Session.set('tag_filter', this.tag);
      //console.log(this.tag);
  }
};

////////// Tracking selected list in URL //////////

var TodosRouter = Backbone.Router.extend({
  routes: {
    ":list_id": "main"
  },
  main: function (list_id) {
    Session.set("list_id", list_id);
    Session.set("tag_filter", null);
  },
  setList: function (list_id) {
    this.navigate(list_id, true);
  }
});

Router = new TodosRouter;

Meteor.startup(function () {
  Backbone.history.start({pushState: true});
});
