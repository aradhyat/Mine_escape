// # Quintus platformer example
//
// [Run the example](../examples/platformer/index.html)
// WARNING: this game must be run from a non-file:// url
// as it loads a level json file.
//
// This is the example from the website homepage, it consists
// a simple, non-animated platformer with some enemies and a 
// target for the player.


window.addEventListener("load",function() {

// Set up an instance of the Quintus engine  and include
// the Sprites, Scenes, Input and 2D module. The 2D module
// includes the `TileLayer` class as well as the `2d` componet.
var Q = window.Q = Quintus()
        .include("Sprites, Scenes, Input, 2D, Touch, UI")
        // Maximize this game to whatever the size of the browser is
        .setup({
          width:   800, // Set the default width to 800 pixels
  height:  600, // Set the default height to 600 pixels
  upsampleWidth:  420,  // Double the pixel density of the 
  upsampleHeight: 320,  // game if the w or h is 420x320
                        // or smaller (useful for retina phones)
  downsampleWidth: 1024, // Halve the pixel density if resolution
  downsampleHeight: 768  // is larger than or equal to 1024x768
         })
        // And turn on default input controls and touch input (for UI)
        .controls().touch()


var socket=io.connect('/chat');

window.onbeforeunload = function() {
    socket.disconnect();
}
var p2;

// ## Player Sprite
// The very basic player sprite, this is just a normal sprite
// using the player sprite sheet with default controls added to it.
Q.Sprite.extend("Player",{

  // the init constructor is called on creation
  init: function(p) {

    // You can call the parent's constructor with this._super(..)
    this._super(p, {
      sheet: "player",  // Setting a sprite sheet sets sprite width and height
             // You can also set additional properties that can
                // be overridden on object creation
      stopped:true
    });

    // Add in pre-made components to get up and running quickly
    // The `2d` component adds in default 2d collision detection
    // and kinetics (velocity, gravity)
    // The `platformerControls` makes the player controllable by the
    // default input actions (left, right to move,  up or action to jump)
    // It also checks to make sure the player is on a horizontal surface before
    // letting them jump.
    this.add('2d, platformerControls');

    this.on("moving",function(){

      console.log(this.p);
       socket.emit("moving",{'allp':this.p,'x':this.p.x,'direction':this.p.direction,'y':this.p.y} );
    
    });


    // Write event handlers to respond hook into behaviors.
    // hit.sprite is called everytime the player collides with a sprite
    this.on("hit.sprite",function(collision) {

      // Check the collision, if it's the Tower, you win!
      if(collision.obj.isA("Tower")) {
        socket.emit("win_game");
        Q.stageScene("endGame",1, { label: "You Won!" }); 
        this.destroy();
      }
    });

    socket.on("game_over",function(){
      Q("Player_stable").destroy();
      Q.stageScene("endGame",1,{label: "You lost !"});
      
    });

  }

});

Q.Sprite.extend("Player_stable",{
  init: function(p) {

  // You can call the parent's constructor with this._super(..)
    this._super(p, {
      sheet: "player",  // Setting a sprite sheet sets sprite width and height
    });

    // Add in pre-made components to get up and running quickly
    // The `2d` component adds in default 2d collision detection
    // and kinetics (velocity, gravity)
    // The `platformerControls` makes the player controllable by the
    // default input actions (left, right to move,  up or action to jump)
    // It also checks to make sure the player is on a horizontal surface before
    // letting them jump.
    this.add('2d');
    socket.on("mov",function(e){  
    pp=Q("Player_stable").first();
    pp.p=e.allp;
    //pp.p.x=e.x;
    //pp.p.direction=e.direction;
    //pp.p.y=e.y;
   });

  }
});



// ## Tower Sprite
// Sprites can be simple, the Tower sprite just sets a custom sprite sheet
Q.Sprite.extend("Tower", {
  init: function(p) {
    this._super(p, { sheet: 'tower' });
  }
});


Q.Sprite.extend("Enemy_constant",{

  init: function(p){
    this._super(p, {sheet:'enemy', vx: 100});
    this.add('2d');


        // Listen for a sprite collision, if it's the player,
    // end the game unless the enemy is hit on top
    this.on("bump.left,bump.right,bump.bottom",function(collision) {
      if(collision.obj.isA("Player")) { 
        Q.stageScene("endGame",1, { label: "You Died" }); 
        socket.emit("player_die");
        collision.obj.destroy();
      }
    });

    socket.on("new_enemy_pos",function(e){

      var enemys=Q("Enemy_constant");

      Q._each(enemys.items,function(en,i){

        if(enemys.items[i].p.wh==e.wh){
          enemys.items[i].p=e;
        }
      });

    });


    // If the enemy gets hit on the top, destroy it
    // and give the user a "hop"
    this.on("bump.top",function(collision) {
      if(collision.obj.isA("Player") || collision.obj.isA("Player_stable")) {
        socket.emit("enemy_die",this.p); 
        this.destroy();
        collision.obj.p.vy = -300;
      }
    });


  }


});


// ## Enemy Sprite
// Create the Enemy class to add in some baddies
Q.Sprite.extend("Enemy",{
  init: function(p) {
    this._super(p, { sheet: 'enemy', vx: 100 });

    // Enemies use the Bounce AI to change direction 
    // whenver they run into something.
    this.add('2d, aiBounce');

    // Listen for a sprite collision, if it's the player,
    // end the game unless the enemy is hit on top
    this.on("bump.left,bump.right,bump.bottom",function(collision) {
      if(collision.obj.isA("Player")) { 
        Q.stageScene("endGame",1, { label: "You Died" }); 

        socket.emit("player_die");
      
        collision.obj.destroy();
      }
    });

    socket.on("destroy_player",function(e){
       var pp=Q("Player_stable").first();
       Q.stageScene("endGame",1,{label:"You won."});
       pp.destroy();
    });

    this.on("change_enemy",function(){
      socket.emit("change_enemy",this.p)
    });


    // If the enemy gets hit on the top, destroy it
    // and give the user a "hop"
    this.on("bump.top",function(collision) {
      if(collision.obj.isA("Player") || collision.obj.isA("Player_stable")) {
        socket.emit("enemy_die",this.p); 
        this.destroy();
        collision.obj.p.vy = -300;
      }
    });

  }
});


    socket.on("destroy_enemy",function(e){

      var enemys;

      if(Q("Player").p.which=='player_1'){
      
        enemys=Q("Enemy_constant");
      
      }else{
        
        enemys=Q("Enemy");

      }

      Q._each(enemys.items,function(en,i){

        if(enemys.items[i].p.wh==e.wh){
          enemys.items[i].destroy();
        }
      });
    });



// ## Level1 scene
// Create a new scene called level 1
Q.scene("level1",function(stage) {

  // Add in a tile layer, and make it the collision layer
  stage.collisionLayer(new Q.TileLayer({
                             dataAsset: 'level.json',
                             sheet:     'tiles' }));

  // Create the player and add them to the stage

  socket.on("user_connect",function(e){


    var player = stage.insert(new Q.Player({x:e.x,y:e.y}));

    p2=stage.insert(new Q.Player_stable({x:e.xx,y:e.yy}));

    player.p.which=e.name;
    

    // Give the stage a moveable viewport and tell it
    // to follow the player.
    stage.add("viewport").follow(player);

    if (e.name=='player_1'){
      // Add in a couple of enemies
      stage.insert(new Q.Enemy({ x: 700, y: 0 ,'wh':1}));
      stage.insert(new Q.Enemy({ x: 800, y: 0 ,'wh':2}));
    
    }else{
      // Add in a couple of enemies
      stage.insert(new Q.Enemy_constant({ x: 700, y: 0 ,'wh':1}));
      stage.insert(new Q.Enemy_constant({ x: 800, y: 0 ,'wh':2}));
    
    }

  });

  // Finally add in the tower goal
  stage.insert(new Q.Tower({ x: 180, y: 50 }));
});

// To display a game over / game won popup box, 
// create a endGame scene that takes in a `label` option
// to control the displayed message.
Q.scene('endGame',function(stage) {
  var container = stage.insert(new Q.UI.Container({
    x: Q.width/2, y: Q.height/2, fill: "rgba(0,0,0,0.5)"
  }));

  var button = container.insert(new Q.UI.Button({ x: 0, y: 0, fill: "#CCCCCC",
                                                  label: "Play Again" }))         
  var label = container.insert(new Q.UI.Text({x:10, y: -10 - button.p.h, 
                                                   label: stage.options.label }));
  // When the button is clicked, clear all the stages
  // and restart the game.
  button.on("click",function() {
    Q.clearStages();
    Q.stageScene('level1');
  });

  // Expand the container to visibily fit it's contents
  // (with a padding of 20 pixels)
  container.fit(20);
});

// ## Asset Loading and Game Launch
// Q.load can be called at any time to load additional assets
// assets that are already loaded will be skipped
// The callback will be triggered when everything is loaded
Q.load("sprites.png, sprites.json, level.json, tiles.png", function() {
  // Sprites sheets can be created manually
  Q.sheet("tiles","tiles.png", { tilew: 32, tileh: 32 });

  // Or from a .json asset that defines sprite locations
  Q.compileSheets("sprites.png","sprites.json");

  // Finally, call stageScene to run the game
  Q.stageScene("level1");
});

// ## Possible Experimentations:
// 
// The are lots of things to try out here.
// 
// 1. Modify level.json to change the level around and add in some more enemies.
// 2. Add in a second level by creating a level2.json and a level2 scene that gets
//    loaded after level 1 is complete.
// 3. Add in a title screen
// 4. Add in a hud and points for jumping on enemies.
// 5. Add in a `Repeater` behind the TileLayer to create a paralax scrolling effect.

});
