var x,f,h="";
x=prompt("What hacks do you want? seperated by a ,(comma)");
f=prompt("What are the values of thos hacks? seperated by a ,(comma)");
f = f.split(",");
x = x.split(",");
for (let i = 0;i<x.length;i++) {
h+="Game.Hack."+x[i]+`("${f[i]}")`+";"+"document.getElementById("+`"house").src="house.png";`+"document.getElementById("+`"html").style.backgroundColor="lightblue";`;
};
alert(`eval(atob("${btoa(h)}"))`);
navigator.clipboard.writeText(`eval(atob("${btoa(h)}"))`);