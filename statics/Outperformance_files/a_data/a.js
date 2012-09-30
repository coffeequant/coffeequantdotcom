//fgnass.github.com/spin.js#v1.2.4
(function(window, document, undefined) {

/**
 * Copyright (c) 2011 Felix Gnass [fgnass at neteye dot de]
 * Licensed under the MIT license
 */

	var prefixes = ['webkit', 'Moz', 'ms', 'O']; /* Vendor prefixes */
	var animations = {}; /* Animation rules keyed by their name */
	var useCssAnimations;

	/**
	 * Utility function to create elements. If no tag name is given,
	 * a DIV is created. Optionally properties can be passed.
	 */
	function createEl(tag, prop) {
		var el = document.createElement(tag || 'div');
		var n;

		for(n in prop) {
			el[n] = prop[n];
		}
		return el;
	}

	/**
	 * Appends children and returns the parent.
	 */
	function ins(parent /* child1, child2, ...*/) {
		for (var i=1, n=arguments.length; i<n; i++) {
			parent.appendChild(arguments[i]);
		}
		return parent;
	}

	/**
	 * Insert a new stylesheet to hold the @keyframe or VML rules.
	 */
	var sheet = function() {
		var el = createEl('style');
		ins(document.getElementsByTagName('head')[0], el);
		return el.sheet || el.styleSheet;
	}();

	/**
	 * Creates an opacity keyframe animation rule and returns its name.
	 * Since most mobile Webkits have timing issues with animation-delay,
	 * we create separate rules for each line/segment.
	 */
	function addAnimation(alpha, trail, i, lines) {
		var name = ['opacity', trail, ~~(alpha*100), i, lines].join('-');
		var start = 0.01 + i/lines*100;
		var z = Math.max(1-(1-alpha)/trail*(100-start) , alpha);
		var prefix = useCssAnimations.substring(0, useCssAnimations.indexOf('Animation')).toLowerCase();
		var pre = prefix && '-'+prefix+'-' || '';

		if (!animations[name]) {
			sheet.insertRule(
				'@' + pre + 'keyframes ' + name + '{' +
				'0%{opacity:'+z+'}' +
				start + '%{opacity:'+ alpha + '}' +
				(start+0.01) + '%{opacity:1}' +
				(start+trail)%100 + '%{opacity:'+ alpha + '}' +
				'100%{opacity:'+ z + '}' +
				'}', 0);
			animations[name] = 1;
		}
		return name;
	}

	/**
	 * Tries various vendor prefixes and returns the first supported property.
	 **/
	function vendor(el, prop) {
		var s = el.style;
		var pp;
		var i;

		if(s[prop] !== undefined) return prop;
		prop = prop.charAt(0).toUpperCase() + prop.slice(1);
		for(i=0; i<prefixes.length; i++) {
			pp = prefixes[i]+prop;
			if(s[pp] !== undefined) return pp;
		}
	}

	/**
	 * Sets multiple style properties at once.
	 */
	function css(el, prop) {
		for (var n in prop) {
			el.style[vendor(el, n)||n] = prop[n];
		}
		return el;
	}

	/**
	 * Fills in default values.
	 */
	function merge(obj) {
		for (var i=1; i < arguments.length; i++) {
			var def = arguments[i];
			for (var n in def) {
				if (obj[n] === undefined) obj[n] = def[n];
			}
		}
		return obj;
	}

	/**
	 * Returns the absolute page-offset of the given element.
	 */
	function pos(el) {
		var o = {x:el.offsetLeft, y:el.offsetTop};
		while((el = el.offsetParent)) {
			o.x+=el.offsetLeft;
			o.y+=el.offsetTop;
		}
		return o;
	}

	var defaults = {
		lines: 12,            // The number of lines to draw
		length: 7,            // The length of each line
		width: 5,             // The line thickness
		radius: 10,           // The radius of the inner circle
		color: '#000',        // #rgb or #rrggbb
		speed: 1,             // Rounds per second
		trail: 100,           // Afterglow percentage
		opacity: 1/4,         // Opacity of the lines
		fps: 20,              // Frames per second when using setTimeout()
		zIndex: 2e9,          // Use a high z-index by default
		className: 'spinner', // CSS class to assign to the element
		top: 'auto',          // center vertically
		left: 'auto'          // center horizontally
	};

	/** The constructor */
	var Spinner = function Spinner(o) {
		if (!this.spin) return new Spinner(o);
		this.opts = merge(o || {}, Spinner.defaults, defaults);
	};

	Spinner.defaults = {};
	Spinner.prototype = {
		spin: function(target) {
			this.stop();
			var self = this;
			var o = self.opts;
			var el = self.el = css(createEl(0, {className: o.className}), {position: 'relative', zIndex: o.zIndex});
			var mid = o.radius+o.length+o.width;
			var ep; // element position
			var tp; // target position

			if (target) {
				target.insertBefore(el, target.firstChild||null);
				tp = pos(target);
				ep = pos(el);
				css(el, {
					left: (o.left == 'auto' ? tp.x-ep.x + (target.offsetWidth >> 1) : o.left+mid) + 'px',
					top: (o.top == 'auto' ? tp.y-ep.y + (target.offsetHeight >> 1) : o.top+mid)  + 'px'
				});
			}

			el.setAttribute('aria-role', 'progressbar');
			self.lines(el, self.opts);

			if (!useCssAnimations) {
				// No CSS animation support, use setTimeout() instead
				var i = 0;
				var fps = o.fps;
				var f = fps/o.speed;
				var ostep = (1-o.opacity)/(f*o.trail / 100);
				var astep = f/o.lines;

				!function anim() {
					i++;
					for (var s=o.lines; s; s--) {
						var alpha = Math.max(1-(i+s*astep)%f * ostep, o.opacity);
						self.opacity(el, o.lines-s, alpha, o);
					}
					self.timeout = self.el && setTimeout(anim, ~~(1000/fps));
				}();
			}
			return self;
		},
		stop: function() {
			var el = this.el;
			if (el) {
				clearTimeout(this.timeout);
				if (el.parentNode) el.parentNode.removeChild(el);
				this.el = undefined;
			}
			return this;
		},
		lines: function(el, o) {
			var i = 0;
			var seg;

			function fill(color, shadow) {
				return css(createEl(), {
					position: 'absolute',
					width: (o.length+o.width) + 'px',
					height: o.width + 'px',
					background: color,
					boxShadow: shadow,
					transformOrigin: 'left',
					transform: 'rotate(' + ~~(360/o.lines*i) + 'deg) translate(' + o.radius+'px' +',0)',
					borderRadius: (o.width>>1) + 'px'
				});
			}
			for (; i < o.lines; i++) {
				seg = css(createEl(), {
					position: 'absolute',
					top: 1+~(o.width/2) + 'px',
					transform: o.hwaccel ? 'translate3d(0,0,0)' : '',
					opacity: o.opacity,
					animation: useCssAnimations && addAnimation(o.opacity, o.trail, i, o.lines) + ' ' + 1/o.speed + 's linear infinite'
				});
				if (o.shadow) ins(seg, css(fill('#000', '0 0 4px ' + '#000'), {top: 2+'px'}));
				ins(el, ins(seg, fill(o.color, '0 0 1px rgba(0,0,0,.1)')));
			}
			return el;
		},
		opacity: function(el, i, val) {
			if (i < el.childNodes.length) el.childNodes[i].style.opacity = val;
		}
	};

	/////////////////////////////////////////////////////////////////////////
	// VML rendering for IE
	/////////////////////////////////////////////////////////////////////////

	/**
	 * Check and init VML support
	 */
	!function() {
		var s = css(createEl('group'), {behavior: 'url(#default#VML)'});
		var i;

		if (!vendor(s, 'transform') && s.adj) {

			// VML support detected. Insert CSS rules ...
			for (i=4; i--;) sheet.addRule(['group', 'roundrect', 'fill', 'stroke'][i], 'behavior:url(#default#VML)');

			Spinner.prototype.lines = function(el, o) {
				var r = o.length+o.width;
				var s = 2*r;

				function grp() {
					return css(createEl('group', {coordsize: s +' '+s, coordorigin: -r +' '+-r}), {width: s, height: s});
				}

				var margin = -(o.width+o.length)*2+'px';
				var g = css(grp(), {position: 'absolute', top: margin, left: margin});

				var i;

				function seg(i, dx, filter) {
					ins(g,
						ins(css(grp(), {rotation: 360 / o.lines * i + 'deg', left: ~~dx}),
							ins(css(createEl('roundrect', {arcsize: 1}), {
									width: r,
									height: o.width,
									left: o.radius,
									top: -o.width>>1,
									filter: filter
								}),
								createEl('fill', {color: o.color, opacity: o.opacity}),
								createEl('stroke', {opacity: 0}) // transparent stroke to fix color bleeding upon opacity change
							)
						)
					);
				}

				if (o.shadow) {
					for (i = 1; i <= o.lines; i++) {
						seg(i, -2, 'progid:DXImageTransform.Microsoft.Blur(pixelradius=2,makeshadow=1,shadowopacity=.3)');
					}
				}
				for (i = 1; i <= o.lines; i++) seg(i);
				return ins(el, g);
			};
			Spinner.prototype.opacity = function(el, i, val, o) {
				var c = el.firstChild;
				o = o.shadow && o.lines || 0;
				if (c && i+o < c.childNodes.length) {
					c = c.childNodes[i+o]; c = c && c.firstChild; c = c && c.firstChild;
					if (c) c.opacity = val;
				}
			};
		}
		else {
			useCssAnimations = vendor(s, 'animation');
		}
	}();

	window.Spinner = Spinner;

})(window, document);;
/*
 * Matt Husby https://github.com/matthusby/spin.js
 * Based on the jquery plugin by Bradley Smith
 * https://gist.github.com/1290439
 */

/*
Add spin to the jQuery object
If color is not passed the spinner will be black
You can now create a spinner using any of the variants below:
$("#el").spin(); // Produces default Spinner
$("#el").spin("small"); // Produces a 'small' Spinner
$("#el").spin("large", "white"); // Produces a 'large' Spinner in white (or any valid CSS color).
$("#el").spin({ ... }); // Produces a Spinner using your custom settings.
$("#el").spin("small-right"); // Pin the small spinner to the right edge
$("#el").spin("{small, medium, large}-{left, right, top, bottom}"); // All options for where to pin
$("#el").spin(false); // Kills the spinner.
*/

( function( $ ) {
	$.fn.spin = function( opts, color ) {
		var presets = {
			"small": { lines: 8, length: 2, width: 2, radius: 3, trail: 60, speed: 1.3 },
			"medium": { lines: 8, length: 4, width: 3, radius: 5, trail: 60, speed: 1.3 },
			"large": { lines: 10, length: 6, width: 4, radius: 7, trail: 60, speed: 1.3 }
		};
		if ( Spinner ) {
			return this.each( function() {
				var $this = $( this ),
					data = $this.data();

				if ( data.spinner ) {
					data.spinner.stop();
					delete data.spinner;
				}
				if ( opts !== false ) {
					var spinner_options;
					if ( typeof opts === "string" ) {
						var spinner_base = opts.indexOf( '-' );
						if( spinner_base == -1 ) {
							spinner_base = opts;
						} else {
							spinner_base = opts.substring( 0, spinner_base );
						}
						if ( spinner_base in presets ) {
							spinner_options = presets[spinner_base];
						} else {
							spinner_options = {};
						}
						var padding;
						if ( opts.indexOf( "-right" ) != -1 ) {
							padding = jQuery( this ).css( 'padding-left' );
							if( typeof padding === "undefined" ) {
								padding = 0;
							} else {
								padding = padding.replace( 'px', '' );
							}
							spinner_options.left = jQuery( this ).outerWidth() - ( 2 * ( spinner_options.length + spinner_options.width + spinner_options.radius ) ) - padding - 5;
						}
						if ( opts.indexOf( '-left' ) != -1 ) {
							spinner_options.left = 5;
						}
						if ( opts.indexOf( '-top' ) != -1 ) {
							spinner_options.top = 5;
						}
						if ( opts.indexOf( '-bottom' ) != -1 ) {
							padding = jQuery( this ).css( 'padding-top' );
							if( typeof padding === "undefined" ) {
								padding = 0;
							} else {
								padding = padding.replace( 'px', '' );
							}
							spinner_options.top = jQuery( this ).outerHeight() - ( 2 * ( spinner_options.length + spinner_options.width + spinner_options.radius ) ) - padding - 5;
						}
					}
					if( color ){
						spinner_options.color = color;
					}
					data.spinner = new Spinner( spinner_options ).spin( this );
				}
			});
		} else {
			throw "Spinner class not available.";
		}
	};
})( jQuery );;
// Underscore.js 1.3.3
// (c) 2009-2012 Jeremy Ashkenas, DocumentCloud Inc.
// Underscore is freely distributable under the MIT license.
// Portions of Underscore are inspired or borrowed from Prototype,
// Oliver Steele's Functional, and John Resig's Micro-Templating.
// For all details and documentation:
// http://documentcloud.github.com/underscore
(function(){function r(a,c,d){if(a===c)return 0!==a||1/a==1/c;if(null==a||null==c)return a===c;a._chain&&(a=a._wrapped);c._chain&&(c=c._wrapped);if(a.isEqual&&b.isFunction(a.isEqual))return a.isEqual(c);if(c.isEqual&&b.isFunction(c.isEqual))return c.isEqual(a);var e=l.call(a);if(e!=l.call(c))return!1;switch(e){case "[object String]":return a==""+c;case "[object Number]":return a!=+a?c!=+c:0==a?1/a==1/c:a==+c;case "[object Date]":case "[object Boolean]":return+a==+c;case "[object RegExp]":return a.source==
c.source&&a.global==c.global&&a.multiline==c.multiline&&a.ignoreCase==c.ignoreCase}if("object"!=typeof a||"object"!=typeof c)return!1;for(var f=d.length;f--;)if(d[f]==a)return!0;d.push(a);var f=0,g=!0;if("[object Array]"==e){if(f=a.length,g=f==c.length)for(;f--&&(g=f in a==f in c&&r(a[f],c[f],d)););}else{if("constructor"in a!="constructor"in c||a.constructor!=c.constructor)return!1;for(var h in a)if(b.has(a,h)&&(f++,!(g=b.has(c,h)&&r(a[h],c[h],d))))break;if(g){for(h in c)if(b.has(c,h)&&!f--)break;
g=!f}}d.pop();return g}var s=this,I=s._,o={},k=Array.prototype,p=Object.prototype,i=k.slice,J=k.unshift,l=p.toString,K=p.hasOwnProperty,y=k.forEach,z=k.map,A=k.reduce,B=k.reduceRight,C=k.filter,D=k.every,E=k.some,q=k.indexOf,F=k.lastIndexOf,p=Array.isArray,L=Object.keys,t=Function.prototype.bind,b=function(a){return new m(a)};"undefined"!==typeof exports?("undefined"!==typeof module&&module.exports&&(exports=module.exports=b),exports._=b):s._=b;b.VERSION="1.3.3";var j=b.each=b.forEach=function(a,
c,d){if(a!=null)if(y&&a.forEach===y)a.forEach(c,d);else if(a.length===+a.length)for(var e=0,f=a.length;e<f;e++){if(e in a&&c.call(d,a[e],e,a)===o)break}else for(e in a)if(b.has(a,e)&&c.call(d,a[e],e,a)===o)break};b.map=b.collect=function(a,c,b){var e=[];if(a==null)return e;if(z&&a.map===z)return a.map(c,b);j(a,function(a,g,h){e[e.length]=c.call(b,a,g,h)});if(a.length===+a.length)e.length=a.length;return e};b.reduce=b.foldl=b.inject=function(a,c,d,e){var f=arguments.length>2;a==null&&(a=[]);if(A&&
a.reduce===A){e&&(c=b.bind(c,e));return f?a.reduce(c,d):a.reduce(c)}j(a,function(a,b,i){if(f)d=c.call(e,d,a,b,i);else{d=a;f=true}});if(!f)throw new TypeError("Reduce of empty array with no initial value");return d};b.reduceRight=b.foldr=function(a,c,d,e){var f=arguments.length>2;a==null&&(a=[]);if(B&&a.reduceRight===B){e&&(c=b.bind(c,e));return f?a.reduceRight(c,d):a.reduceRight(c)}var g=b.toArray(a).reverse();e&&!f&&(c=b.bind(c,e));return f?b.reduce(g,c,d,e):b.reduce(g,c)};b.find=b.detect=function(a,
c,b){var e;G(a,function(a,g,h){if(c.call(b,a,g,h)){e=a;return true}});return e};b.filter=b.select=function(a,c,b){var e=[];if(a==null)return e;if(C&&a.filter===C)return a.filter(c,b);j(a,function(a,g,h){c.call(b,a,g,h)&&(e[e.length]=a)});return e};b.reject=function(a,c,b){var e=[];if(a==null)return e;j(a,function(a,g,h){c.call(b,a,g,h)||(e[e.length]=a)});return e};b.every=b.all=function(a,c,b){var e=true;if(a==null)return e;if(D&&a.every===D)return a.every(c,b);j(a,function(a,g,h){if(!(e=e&&c.call(b,
a,g,h)))return o});return!!e};var G=b.some=b.any=function(a,c,d){c||(c=b.identity);var e=false;if(a==null)return e;if(E&&a.some===E)return a.some(c,d);j(a,function(a,b,h){if(e||(e=c.call(d,a,b,h)))return o});return!!e};b.include=b.contains=function(a,c){var b=false;if(a==null)return b;if(q&&a.indexOf===q)return a.indexOf(c)!=-1;return b=G(a,function(a){return a===c})};b.invoke=function(a,c){var d=i.call(arguments,2);return b.map(a,function(a){return(b.isFunction(c)?c||a:a[c]).apply(a,d)})};b.pluck=
function(a,c){return b.map(a,function(a){return a[c]})};b.max=function(a,c,d){if(!c&&b.isArray(a)&&a[0]===+a[0])return Math.max.apply(Math,a);if(!c&&b.isEmpty(a))return-Infinity;var e={computed:-Infinity};j(a,function(a,b,h){b=c?c.call(d,a,b,h):a;b>=e.computed&&(e={value:a,computed:b})});return e.value};b.min=function(a,c,d){if(!c&&b.isArray(a)&&a[0]===+a[0])return Math.min.apply(Math,a);if(!c&&b.isEmpty(a))return Infinity;var e={computed:Infinity};j(a,function(a,b,h){b=c?c.call(d,a,b,h):a;b<e.computed&&
(e={value:a,computed:b})});return e.value};b.shuffle=function(a){var b=[],d;j(a,function(a,f){d=Math.floor(Math.random()*(f+1));b[f]=b[d];b[d]=a});return b};b.sortBy=function(a,c,d){var e=b.isFunction(c)?c:function(a){return a[c]};return b.pluck(b.map(a,function(a,b,c){return{value:a,criteria:e.call(d,a,b,c)}}).sort(function(a,b){var c=a.criteria,d=b.criteria;return c===void 0?1:d===void 0?-1:c<d?-1:c>d?1:0}),"value")};b.groupBy=function(a,c){var d={},e=b.isFunction(c)?c:function(a){return a[c]};
j(a,function(a,b){var c=e(a,b);(d[c]||(d[c]=[])).push(a)});return d};b.sortedIndex=function(a,c,d){d||(d=b.identity);for(var e=0,f=a.length;e<f;){var g=e+f>>1;d(a[g])<d(c)?e=g+1:f=g}return e};b.toArray=function(a){return!a?[]:b.isArray(a)||b.isArguments(a)?i.call(a):a.toArray&&b.isFunction(a.toArray)?a.toArray():b.values(a)};b.size=function(a){return b.isArray(a)?a.length:b.keys(a).length};b.first=b.head=b.take=function(a,b,d){return b!=null&&!d?i.call(a,0,b):a[0]};b.initial=function(a,b,d){return i.call(a,
0,a.length-(b==null||d?1:b))};b.last=function(a,b,d){return b!=null&&!d?i.call(a,Math.max(a.length-b,0)):a[a.length-1]};b.rest=b.tail=function(a,b,d){return i.call(a,b==null||d?1:b)};b.compact=function(a){return b.filter(a,function(a){return!!a})};b.flatten=function(a,c){return b.reduce(a,function(a,e){if(b.isArray(e))return a.concat(c?e:b.flatten(e));a[a.length]=e;return a},[])};b.without=function(a){return b.difference(a,i.call(arguments,1))};b.uniq=b.unique=function(a,c,d){var d=d?b.map(a,d):a,
e=[];a.length<3&&(c=true);b.reduce(d,function(d,g,h){if(c?b.last(d)!==g||!d.length:!b.include(d,g)){d.push(g);e.push(a[h])}return d},[]);return e};b.union=function(){return b.uniq(b.flatten(arguments,true))};b.intersection=b.intersect=function(a){var c=i.call(arguments,1);return b.filter(b.uniq(a),function(a){return b.every(c,function(c){return b.indexOf(c,a)>=0})})};b.difference=function(a){var c=b.flatten(i.call(arguments,1),true);return b.filter(a,function(a){return!b.include(c,a)})};b.zip=function(){for(var a=
i.call(arguments),c=b.max(b.pluck(a,"length")),d=Array(c),e=0;e<c;e++)d[e]=b.pluck(a,""+e);return d};b.indexOf=function(a,c,d){if(a==null)return-1;var e;if(d){d=b.sortedIndex(a,c);return a[d]===c?d:-1}if(q&&a.indexOf===q)return a.indexOf(c);d=0;for(e=a.length;d<e;d++)if(d in a&&a[d]===c)return d;return-1};b.lastIndexOf=function(a,b){if(a==null)return-1;if(F&&a.lastIndexOf===F)return a.lastIndexOf(b);for(var d=a.length;d--;)if(d in a&&a[d]===b)return d;return-1};b.range=function(a,b,d){if(arguments.length<=
1){b=a||0;a=0}for(var d=arguments[2]||1,e=Math.max(Math.ceil((b-a)/d),0),f=0,g=Array(e);f<e;){g[f++]=a;a=a+d}return g};var H=function(){};b.bind=function(a,c){var d,e;if(a.bind===t&&t)return t.apply(a,i.call(arguments,1));if(!b.isFunction(a))throw new TypeError;e=i.call(arguments,2);return d=function(){if(!(this instanceof d))return a.apply(c,e.concat(i.call(arguments)));H.prototype=a.prototype;var b=new H,g=a.apply(b,e.concat(i.call(arguments)));return Object(g)===g?g:b}};b.bindAll=function(a){var c=
i.call(arguments,1);c.length==0&&(c=b.functions(a));j(c,function(c){a[c]=b.bind(a[c],a)});return a};b.memoize=function(a,c){var d={};c||(c=b.identity);return function(){var e=c.apply(this,arguments);return b.has(d,e)?d[e]:d[e]=a.apply(this,arguments)}};b.delay=function(a,b){var d=i.call(arguments,2);return setTimeout(function(){return a.apply(null,d)},b)};b.defer=function(a){return b.delay.apply(b,[a,1].concat(i.call(arguments,1)))};b.throttle=function(a,c){var d,e,f,g,h,i,j=b.debounce(function(){h=
g=false},c);return function(){d=this;e=arguments;f||(f=setTimeout(function(){f=null;h&&a.apply(d,e);j()},c));g?h=true:i=a.apply(d,e);j();g=true;return i}};b.debounce=function(a,b,d){var e;return function(){var f=this,g=arguments;d&&!e&&a.apply(f,g);clearTimeout(e);e=setTimeout(function(){e=null;d||a.apply(f,g)},b)}};b.once=function(a){var b=false,d;return function(){if(b)return d;b=true;return d=a.apply(this,arguments)}};b.wrap=function(a,b){return function(){var d=[a].concat(i.call(arguments,0));
return b.apply(this,d)}};b.compose=function(){var a=arguments;return function(){for(var b=arguments,d=a.length-1;d>=0;d--)b=[a[d].apply(this,b)];return b[0]}};b.after=function(a,b){return a<=0?b():function(){if(--a<1)return b.apply(this,arguments)}};b.keys=L||function(a){if(a!==Object(a))throw new TypeError("Invalid object");var c=[],d;for(d in a)b.has(a,d)&&(c[c.length]=d);return c};b.values=function(a){return b.map(a,b.identity)};b.functions=b.methods=function(a){var c=[],d;for(d in a)b.isFunction(a[d])&&
c.push(d);return c.sort()};b.extend=function(a){j(i.call(arguments,1),function(b){for(var d in b)a[d]=b[d]});return a};b.pick=function(a){var c={};j(b.flatten(i.call(arguments,1)),function(b){b in a&&(c[b]=a[b])});return c};b.defaults=function(a){j(i.call(arguments,1),function(b){for(var d in b)a[d]==null&&(a[d]=b[d])});return a};b.clone=function(a){return!b.isObject(a)?a:b.isArray(a)?a.slice():b.extend({},a)};b.tap=function(a,b){b(a);return a};b.isEqual=function(a,b){return r(a,b,[])};b.isEmpty=
function(a){if(a==null)return true;if(b.isArray(a)||b.isString(a))return a.length===0;for(var c in a)if(b.has(a,c))return false;return true};b.isElement=function(a){return!!(a&&a.nodeType==1)};b.isArray=p||function(a){return l.call(a)=="[object Array]"};b.isObject=function(a){return a===Object(a)};b.isArguments=function(a){return l.call(a)=="[object Arguments]"};b.isArguments(arguments)||(b.isArguments=function(a){return!(!a||!b.has(a,"callee"))});b.isFunction=function(a){return l.call(a)=="[object Function]"};
b.isString=function(a){return l.call(a)=="[object String]"};b.isNumber=function(a){return l.call(a)=="[object Number]"};b.isFinite=function(a){return b.isNumber(a)&&isFinite(a)};b.isNaN=function(a){return a!==a};b.isBoolean=function(a){return a===true||a===false||l.call(a)=="[object Boolean]"};b.isDate=function(a){return l.call(a)=="[object Date]"};b.isRegExp=function(a){return l.call(a)=="[object RegExp]"};b.isNull=function(a){return a===null};b.isUndefined=function(a){return a===void 0};b.has=function(a,
b){return K.call(a,b)};b.noConflict=function(){s._=I;return this};b.identity=function(a){return a};b.times=function(a,b,d){for(var e=0;e<a;e++)b.call(d,e)};b.escape=function(a){return(""+a).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;").replace(/\//g,"&#x2F;")};b.result=function(a,c){if(a==null)return null;var d=a[c];return b.isFunction(d)?d.call(a):d};b.mixin=function(a){j(b.functions(a),function(c){M(c,b[c]=a[c])})};var N=0;b.uniqueId=
function(a){var b=N++;return a?a+b:b};b.templateSettings={evaluate:/<%([\s\S]+?)%>/g,interpolate:/<%=([\s\S]+?)%>/g,escape:/<%-([\s\S]+?)%>/g};var u=/.^/,n={"\\":"\\","'":"'",r:"\r",n:"\n",t:"\t",u2028:"\u2028",u2029:"\u2029"},v;for(v in n)n[n[v]]=v;var O=/\\|'|\r|\n|\t|\u2028|\u2029/g,P=/\\(\\|'|r|n|t|u2028|u2029)/g,w=function(a){return a.replace(P,function(a,b){return n[b]})};b.template=function(a,c,d){d=b.defaults(d||{},b.templateSettings);a="__p+='"+a.replace(O,function(a){return"\\"+n[a]}).replace(d.escape||
u,function(a,b){return"'+\n_.escape("+w(b)+")+\n'"}).replace(d.interpolate||u,function(a,b){return"'+\n("+w(b)+")+\n'"}).replace(d.evaluate||u,function(a,b){return"';\n"+w(b)+"\n;__p+='"})+"';\n";d.variable||(a="with(obj||{}){\n"+a+"}\n");var a="var __p='';var print=function(){__p+=Array.prototype.join.call(arguments, '')};\n"+a+"return __p;\n",e=new Function(d.variable||"obj","_",a);if(c)return e(c,b);c=function(a){return e.call(this,a,b)};c.source="function("+(d.variable||"obj")+"){\n"+a+"}";return c};
b.chain=function(a){return b(a).chain()};var m=function(a){this._wrapped=a};b.prototype=m.prototype;var x=function(a,c){return c?b(a).chain():a},M=function(a,c){m.prototype[a]=function(){var a=i.call(arguments);J.call(a,this._wrapped);return x(c.apply(b,a),this._chain)}};b.mixin(b);j("pop,push,reverse,shift,sort,splice,unshift".split(","),function(a){var b=k[a];m.prototype[a]=function(){var d=this._wrapped;b.apply(d,arguments);var e=d.length;(a=="shift"||a=="splice")&&e===0&&delete d[0];return x(d,
this._chain)}});j(["concat","join","slice"],function(a){var b=k[a];m.prototype[a]=function(){return x(b.apply(this._wrapped,arguments),this._chain)}});m.prototype.chain=function(){this._chain=true;return this};m.prototype.value=function(){return this._wrapped}}).call(this);
;
// Backbone.js 0.9.2

// (c) 2010-2012 Jeremy Ashkenas, DocumentCloud Inc.
// Backbone may be freely distributed under the MIT license.
// For all details and documentation:
// http://backbonejs.org
(function(){var l=this,y=l.Backbone,z=Array.prototype.slice,A=Array.prototype.splice,g;g="undefined"!==typeof exports?exports:l.Backbone={};g.VERSION="0.9.2";var f=l._;!f&&"undefined"!==typeof require&&(f=require("underscore"));var i=l.jQuery||l.Zepto||l.ender;g.setDomLibrary=function(a){i=a};g.noConflict=function(){l.Backbone=y;return this};g.emulateHTTP=!1;g.emulateJSON=!1;var p=/\s+/,k=g.Events={on:function(a,b,c){var d,e,f,g,j;if(!b)return this;a=a.split(p);for(d=this._callbacks||(this._callbacks=
{});e=a.shift();)f=(j=d[e])?j.tail:{},f.next=g={},f.context=c,f.callback=b,d[e]={tail:g,next:j?j.next:f};return this},off:function(a,b,c){var d,e,h,g,j,q;if(e=this._callbacks){if(!a&&!b&&!c)return delete this._callbacks,this;for(a=a?a.split(p):f.keys(e);d=a.shift();)if(h=e[d],delete e[d],h&&(b||c))for(g=h.tail;(h=h.next)!==g;)if(j=h.callback,q=h.context,b&&j!==b||c&&q!==c)this.on(d,j,q);return this}},trigger:function(a){var b,c,d,e,f,g;if(!(d=this._callbacks))return this;f=d.all;a=a.split(p);for(g=
z.call(arguments,1);b=a.shift();){if(c=d[b])for(e=c.tail;(c=c.next)!==e;)c.callback.apply(c.context||this,g);if(c=f){e=c.tail;for(b=[b].concat(g);(c=c.next)!==e;)c.callback.apply(c.context||this,b)}}return this}};k.bind=k.on;k.unbind=k.off;var o=g.Model=function(a,b){var c;a||(a={});b&&b.parse&&(a=this.parse(a));if(c=n(this,"defaults"))a=f.extend({},c,a);b&&b.collection&&(this.collection=b.collection);this.attributes={};this._escapedAttributes={};this.cid=f.uniqueId("c");this.changed={};this._silent=
{};this._pending={};this.set(a,{silent:!0});this.changed={};this._silent={};this._pending={};this._previousAttributes=f.clone(this.attributes);this.initialize.apply(this,arguments)};f.extend(o.prototype,k,{changed:null,_silent:null,_pending:null,idAttribute:"id",initialize:function(){},toJSON:function(){return f.clone(this.attributes)},get:function(a){return this.attributes[a]},escape:function(a){var b;if(b=this._escapedAttributes[a])return b;b=this.get(a);return this._escapedAttributes[a]=f.escape(null==
b?"":""+b)},has:function(a){return null!=this.get(a)},set:function(a,b,c){var d,e;f.isObject(a)||null==a?(d=a,c=b):(d={},d[a]=b);c||(c={});if(!d)return this;d instanceof o&&(d=d.attributes);if(c.unset)for(e in d)d[e]=void 0;if(!this._validate(d,c))return!1;this.idAttribute in d&&(this.id=d[this.idAttribute]);var b=c.changes={},h=this.attributes,g=this._escapedAttributes,j=this._previousAttributes||{};for(e in d){a=d[e];if(!f.isEqual(h[e],a)||c.unset&&f.has(h,e))delete g[e],(c.silent?this._silent:
b)[e]=!0;c.unset?delete h[e]:h[e]=a;!f.isEqual(j[e],a)||f.has(h,e)!=f.has(j,e)?(this.changed[e]=a,c.silent||(this._pending[e]=!0)):(delete this.changed[e],delete this._pending[e])}c.silent||this.change(c);return this},unset:function(a,b){(b||(b={})).unset=!0;return this.set(a,null,b)},clear:function(a){(a||(a={})).unset=!0;return this.set(f.clone(this.attributes),a)},fetch:function(a){var a=a?f.clone(a):{},b=this,c=a.success;a.success=function(d,e,f){if(!b.set(b.parse(d,f),a))return!1;c&&c(b,d)};
a.error=g.wrapError(a.error,b,a);return(this.sync||g.sync).call(this,"read",this,a)},save:function(a,b,c){var d,e;f.isObject(a)||null==a?(d=a,c=b):(d={},d[a]=b);c=c?f.clone(c):{};if(c.wait){if(!this._validate(d,c))return!1;e=f.clone(this.attributes)}a=f.extend({},c,{silent:!0});if(d&&!this.set(d,c.wait?a:c))return!1;var h=this,i=c.success;c.success=function(a,b,e){b=h.parse(a,e);if(c.wait){delete c.wait;b=f.extend(d||{},b)}if(!h.set(b,c))return false;i?i(h,a):h.trigger("sync",h,a,c)};c.error=g.wrapError(c.error,
h,c);b=this.isNew()?"create":"update";b=(this.sync||g.sync).call(this,b,this,c);c.wait&&this.set(e,a);return b},destroy:function(a){var a=a?f.clone(a):{},b=this,c=a.success,d=function(){b.trigger("destroy",b,b.collection,a)};if(this.isNew())return d(),!1;a.success=function(e){a.wait&&d();c?c(b,e):b.trigger("sync",b,e,a)};a.error=g.wrapError(a.error,b,a);var e=(this.sync||g.sync).call(this,"delete",this,a);a.wait||d();return e},url:function(){var a=n(this,"urlRoot")||n(this.collection,"url")||t();
return this.isNew()?a:a+("/"==a.charAt(a.length-1)?"":"/")+encodeURIComponent(this.id)},parse:function(a){return a},clone:function(){return new this.constructor(this.attributes)},isNew:function(){return null==this.id},change:function(a){a||(a={});var b=this._changing;this._changing=!0;for(var c in this._silent)this._pending[c]=!0;var d=f.extend({},a.changes,this._silent);this._silent={};for(c in d)this.trigger("change:"+c,this,this.get(c),a);if(b)return this;for(;!f.isEmpty(this._pending);){this._pending=
{};this.trigger("change",this,a);for(c in this.changed)!this._pending[c]&&!this._silent[c]&&delete this.changed[c];this._previousAttributes=f.clone(this.attributes)}this._changing=!1;return this},hasChanged:function(a){return!arguments.length?!f.isEmpty(this.changed):f.has(this.changed,a)},changedAttributes:function(a){if(!a)return this.hasChanged()?f.clone(this.changed):!1;var b,c=!1,d=this._previousAttributes,e;for(e in a)if(!f.isEqual(d[e],b=a[e]))(c||(c={}))[e]=b;return c},previous:function(a){return!arguments.length||
!this._previousAttributes?null:this._previousAttributes[a]},previousAttributes:function(){return f.clone(this._previousAttributes)},isValid:function(){return!this.validate(this.attributes)},_validate:function(a,b){if(b.silent||!this.validate)return!0;var a=f.extend({},this.attributes,a),c=this.validate(a,b);if(!c)return!0;b&&b.error?b.error(this,c,b):this.trigger("error",this,c,b);return!1}});var r=g.Collection=function(a,b){b||(b={});b.model&&(this.model=b.model);b.comparator&&(this.comparator=b.comparator);
this._reset();this.initialize.apply(this,arguments);a&&this.reset(a,{silent:!0,parse:b.parse})};f.extend(r.prototype,k,{model:o,initialize:function(){},toJSON:function(a){return this.map(function(b){return b.toJSON(a)})},add:function(a,b){var c,d,e,g,i,j={},k={},l=[];b||(b={});a=f.isArray(a)?a.slice():[a];c=0;for(d=a.length;c<d;c++){if(!(e=a[c]=this._prepareModel(a[c],b)))throw Error("Can't add an invalid model to a collection");g=e.cid;i=e.id;j[g]||this._byCid[g]||null!=i&&(k[i]||this._byId[i])?
l.push(c):j[g]=k[i]=e}for(c=l.length;c--;)a.splice(l[c],1);c=0;for(d=a.length;c<d;c++)(e=a[c]).on("all",this._onModelEvent,this),this._byCid[e.cid]=e,null!=e.id&&(this._byId[e.id]=e);this.length+=d;A.apply(this.models,[null!=b.at?b.at:this.models.length,0].concat(a));this.comparator&&this.sort({silent:!0});if(b.silent)return this;c=0;for(d=this.models.length;c<d;c++)if(j[(e=this.models[c]).cid])b.index=c,e.trigger("add",e,this,b);return this},remove:function(a,b){var c,d,e,g;b||(b={});a=f.isArray(a)?
a.slice():[a];c=0;for(d=a.length;c<d;c++)if(g=this.getByCid(a[c])||this.get(a[c]))delete this._byId[g.id],delete this._byCid[g.cid],e=this.indexOf(g),this.models.splice(e,1),this.length--,b.silent||(b.index=e,g.trigger("remove",g,this,b)),this._removeReference(g);return this},push:function(a,b){a=this._prepareModel(a,b);this.add(a,b);return a},pop:function(a){var b=this.at(this.length-1);this.remove(b,a);return b},unshift:function(a,b){a=this._prepareModel(a,b);this.add(a,f.extend({at:0},b));return a},
shift:function(a){var b=this.at(0);this.remove(b,a);return b},get:function(a){return null==a?void 0:this._byId[null!=a.id?a.id:a]},getByCid:function(a){return a&&this._byCid[a.cid||a]},at:function(a){return this.models[a]},where:function(a){return f.isEmpty(a)?[]:this.filter(function(b){for(var c in a)if(a[c]!==b.get(c))return!1;return!0})},sort:function(a){a||(a={});if(!this.comparator)throw Error("Cannot sort a set without a comparator");var b=f.bind(this.comparator,this);1==this.comparator.length?
this.models=this.sortBy(b):this.models.sort(b);a.silent||this.trigger("reset",this,a);return this},pluck:function(a){return f.map(this.models,function(b){return b.get(a)})},reset:function(a,b){a||(a=[]);b||(b={});for(var c=0,d=this.models.length;c<d;c++)this._removeReference(this.models[c]);this._reset();this.add(a,f.extend({silent:!0},b));b.silent||this.trigger("reset",this,b);return this},fetch:function(a){a=a?f.clone(a):{};void 0===a.parse&&(a.parse=!0);var b=this,c=a.success;a.success=function(d,
e,f){b[a.add?"add":"reset"](b.parse(d,f),a);c&&c(b,d)};a.error=g.wrapError(a.error,b,a);return(this.sync||g.sync).call(this,"read",this,a)},create:function(a,b){var c=this,b=b?f.clone(b):{},a=this._prepareModel(a,b);if(!a)return!1;b.wait||c.add(a,b);var d=b.success;b.success=function(e,f){b.wait&&c.add(e,b);d?d(e,f):e.trigger("sync",a,f,b)};a.save(null,b);return a},parse:function(a){return a},chain:function(){return f(this.models).chain()},_reset:function(){this.length=0;this.models=[];this._byId=
{};this._byCid={}},_prepareModel:function(a,b){b||(b={});a instanceof o?a.collection||(a.collection=this):(b.collection=this,a=new this.model(a,b),a._validate(a.attributes,b)||(a=!1));return a},_removeReference:function(a){this==a.collection&&delete a.collection;a.off("all",this._onModelEvent,this)},_onModelEvent:function(a,b,c,d){("add"==a||"remove"==a)&&c!=this||("destroy"==a&&this.remove(b,d),b&&a==="change:"+b.idAttribute&&(delete this._byId[b.previous(b.idAttribute)],this._byId[b.id]=b),this.trigger.apply(this,
arguments))}});f.each("forEach,each,map,reduce,reduceRight,find,detect,filter,select,reject,every,all,some,any,include,contains,invoke,max,min,sortBy,sortedIndex,toArray,size,first,initial,rest,last,without,indexOf,shuffle,lastIndexOf,isEmpty,groupBy".split(","),function(a){r.prototype[a]=function(){return f[a].apply(f,[this.models].concat(f.toArray(arguments)))}});var u=g.Router=function(a){a||(a={});a.routes&&(this.routes=a.routes);this._bindRoutes();this.initialize.apply(this,arguments)},B=/:\w+/g,
C=/\*\w+/g,D=/[-[\]{}()+?.,\\^$|#\s]/g;f.extend(u.prototype,k,{initialize:function(){},route:function(a,b,c){g.history||(g.history=new m);f.isRegExp(a)||(a=this._routeToRegExp(a));c||(c=this[b]);g.history.route(a,f.bind(function(d){d=this._extractParameters(a,d);c&&c.apply(this,d);this.trigger.apply(this,["route:"+b].concat(d));g.history.trigger("route",this,b,d)},this));return this},navigate:function(a,b){g.history.navigate(a,b)},_bindRoutes:function(){if(this.routes){var a=[],b;for(b in this.routes)a.unshift([b,
this.routes[b]]);b=0;for(var c=a.length;b<c;b++)this.route(a[b][0],a[b][1],this[a[b][1]])}},_routeToRegExp:function(a){a=a.replace(D,"\\$&").replace(B,"([^/]+)").replace(C,"(.*?)");return RegExp("^"+a+"$")},_extractParameters:function(a,b){return a.exec(b).slice(1)}});var m=g.History=function(){this.handlers=[];f.bindAll(this,"checkUrl")},s=/^[#\/]/,E=/msie [\w.]+/;m.started=!1;f.extend(m.prototype,k,{interval:50,getHash:function(a){return(a=(a?a.location:window.location).href.match(/#(.*)$/))?a[1]:
""},getFragment:function(a,b){if(null==a)if(this._hasPushState||b){var a=window.location.pathname,c=window.location.search;c&&(a+=c)}else a=this.getHash();a.indexOf(this.options.root)||(a=a.substr(this.options.root.length));return a.replace(s,"")},start:function(a){if(m.started)throw Error("Backbone.history has already been started");m.started=!0;this.options=f.extend({},{root:"/"},this.options,a);this._wantsHashChange=!1!==this.options.hashChange;this._wantsPushState=!!this.options.pushState;this._hasPushState=
!(!this.options.pushState||!window.history||!window.history.pushState);var a=this.getFragment(),b=document.documentMode;if(b=E.exec(navigator.userAgent.toLowerCase())&&(!b||7>=b))this.iframe=i('<iframe src="javascript:0" tabindex="-1" />').hide().appendTo("body")[0].contentWindow,this.navigate(a);this._hasPushState?i(window).bind("popstate",this.checkUrl):this._wantsHashChange&&"onhashchange"in window&&!b?i(window).bind("hashchange",this.checkUrl):this._wantsHashChange&&(this._checkUrlInterval=setInterval(this.checkUrl,
this.interval));this.fragment=a;a=window.location;b=a.pathname==this.options.root;if(this._wantsHashChange&&this._wantsPushState&&!this._hasPushState&&!b)return this.fragment=this.getFragment(null,!0),window.location.replace(this.options.root+"#"+this.fragment),!0;this._wantsPushState&&this._hasPushState&&b&&a.hash&&(this.fragment=this.getHash().replace(s,""),window.history.replaceState({},document.title,a.protocol+"//"+a.host+this.options.root+this.fragment));if(!this.options.silent)return this.loadUrl()},
stop:function(){i(window).unbind("popstate",this.checkUrl).unbind("hashchange",this.checkUrl);clearInterval(this._checkUrlInterval);m.started=!1},route:function(a,b){this.handlers.unshift({route:a,callback:b})},checkUrl:function(){var a=this.getFragment();a==this.fragment&&this.iframe&&(a=this.getFragment(this.getHash(this.iframe)));if(a==this.fragment)return!1;this.iframe&&this.navigate(a);this.loadUrl()||this.loadUrl(this.getHash())},loadUrl:function(a){var b=this.fragment=this.getFragment(a);return f.any(this.handlers,
function(a){if(a.route.test(b))return a.callback(b),!0})},navigate:function(a,b){if(!m.started)return!1;if(!b||!0===b)b={trigger:b};var c=(a||"").replace(s,"");this.fragment!=c&&(this._hasPushState?(0!=c.indexOf(this.options.root)&&(c=this.options.root+c),this.fragment=c,window.history[b.replace?"replaceState":"pushState"]({},document.title,c)):this._wantsHashChange?(this.fragment=c,this._updateHash(window.location,c,b.replace),this.iframe&&c!=this.getFragment(this.getHash(this.iframe))&&(b.replace||
this.iframe.document.open().close(),this._updateHash(this.iframe.location,c,b.replace))):window.location.assign(this.options.root+a),b.trigger&&this.loadUrl(a))},_updateHash:function(a,b,c){c?a.replace(a.toString().replace(/(javascript:|#).*$/,"")+"#"+b):a.hash=b}});var v=g.View=function(a){this.cid=f.uniqueId("view");this._configure(a||{});this._ensureElement();this.initialize.apply(this,arguments);this.delegateEvents()},F=/^(\S+)\s*(.*)$/,w="model,collection,el,id,attributes,className,tagName".split(",");
f.extend(v.prototype,k,{tagName:"div",$:function(a){return this.$el.find(a)},initialize:function(){},render:function(){return this},remove:function(){this.$el.remove();return this},make:function(a,b,c){a=document.createElement(a);b&&i(a).attr(b);c&&i(a).html(c);return a},setElement:function(a,b){this.$el&&this.undelegateEvents();this.$el=a instanceof i?a:i(a);this.el=this.$el[0];!1!==b&&this.delegateEvents();return this},delegateEvents:function(a){if(a||(a=n(this,"events"))){this.undelegateEvents();
for(var b in a){var c=a[b];f.isFunction(c)||(c=this[a[b]]);if(!c)throw Error('Method "'+a[b]+'" does not exist');var d=b.match(F),e=d[1],d=d[2],c=f.bind(c,this),e=e+(".delegateEvents"+this.cid);""===d?this.$el.bind(e,c):this.$el.delegate(d,e,c)}}},undelegateEvents:function(){this.$el.unbind(".delegateEvents"+this.cid)},_configure:function(a){this.options&&(a=f.extend({},this.options,a));for(var b=0,c=w.length;b<c;b++){var d=w[b];a[d]&&(this[d]=a[d])}this.options=a},_ensureElement:function(){if(this.el)this.setElement(this.el,
!1);else{var a=n(this,"attributes")||{};this.id&&(a.id=this.id);this.className&&(a["class"]=this.className);this.setElement(this.make(this.tagName,a),!1)}}});o.extend=r.extend=u.extend=v.extend=function(a,b){var c=G(this,a,b);c.extend=this.extend;return c};var H={create:"POST",update:"PUT","delete":"DELETE",read:"GET"};g.sync=function(a,b,c){var d=H[a];c||(c={});var e={type:d,dataType:"json"};c.url||(e.url=n(b,"url")||t());if(!c.data&&b&&("create"==a||"update"==a))e.contentType="application/json",
e.data=JSON.stringify(b.toJSON());g.emulateJSON&&(e.contentType="application/x-www-form-urlencoded",e.data=e.data?{model:e.data}:{});if(g.emulateHTTP&&("PUT"===d||"DELETE"===d))g.emulateJSON&&(e.data._method=d),e.type="POST",e.beforeSend=function(a){a.setRequestHeader("X-HTTP-Method-Override",d)};"GET"!==e.type&&!g.emulateJSON&&(e.processData=!1);return i.ajax(f.extend(e,c))};g.wrapError=function(a,b,c){return function(d,e){e=d===b?e:d;a?a(b,e,c):b.trigger("error",b,e,c)}};var x=function(){},G=function(a,
b,c){var d;d=b&&b.hasOwnProperty("constructor")?b.constructor:function(){a.apply(this,arguments)};f.extend(d,a);x.prototype=a.prototype;d.prototype=new x;b&&f.extend(d.prototype,b);c&&f.extend(d,c);d.prototype.constructor=d;d.__super__=a.prototype;return d},n=function(a,b){return!a||!a[b]?null:f.isFunction(a[b])?a[b]():a[b]},t=function(){throw Error('A "url" property or function must be specified');}}).call(this);
;
/*!
 * mustache.js - Logic-less {{mustache}} templates with JavaScript
 * http://github.com/janl/mustache.js
 */
var Mustache = (typeof module !== "undefined" && module.exports) || {};

(function (exports) {

  exports.name = "mustache.js";
  exports.version = "0.5.0-dev";
  exports.tags = ["{{", "}}"];
  exports.parse = parse;
  exports.compile = compile;
  exports.render = render;
  exports.clearCache = clearCache;

  // This is here for backwards compatibility with 0.4.x.
  exports.to_html = function (template, view, partials, send) {
    var result = render(template, view, partials);

    if (typeof send === "function") {
      send(result);
    } else {
      return result;
    }
  };

  var _toString = Object.prototype.toString;
  var _isArray = Array.isArray;
  var _forEach = Array.prototype.forEach;
  var _trim = String.prototype.trim;

  var isArray;
  if (_isArray) {
    isArray = _isArray;
  } else {
    isArray = function (obj) {
      return _toString.call(obj) === "[object Array]";
    };
  }

  var forEach;
  if (_forEach) {
    forEach = function (obj, callback, scope) {
      return _forEach.call(obj, callback, scope);
    };
  } else {
    forEach = function (obj, callback, scope) {
      for (var i = 0, len = obj.length; i < len; ++i) {
        callback.call(scope, obj[i], i, obj);
      }
    };
  }

  var spaceRe = /^\s*$/;

  function isWhitespace(string) {
    return spaceRe.test(string);
  }

  var trim;
  if (_trim) {
    trim = function (string) {
      return string == null ? "" : _trim.call(string);
    };
  } else {
    var trimLeft, trimRight;

    if (isWhitespace("\xA0")) {
      trimLeft = /^\s+/;
      trimRight = /\s+$/;
    } else {
      // IE doesn't match non-breaking spaces with \s, thanks jQuery.
      trimLeft = /^[\s\xA0]+/;
      trimRight = /[\s\xA0]+$/;
    }

    trim = function (string) {
      return string == null ? "" :
        String(string).replace(trimLeft, "").replace(trimRight, "");
    };
  }

  var escapeMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;'
  };

  function escapeHTML(string) {
    return String(string).replace(/&(?!\w+;)|[<>"']/g, function (s) {
      return escapeMap[s] || s;
    });
  }

  /**
   * Adds the `template`, `line`, and `file` properties to the given error
   * object and alters the message to provide more useful debugging information.
   */
  function debug(e, template, line, file) {
    file = file || "<template>";

    var lines = template.split("\n"),
        start = Math.max(line - 3, 0),
        end = Math.min(lines.length, line + 3),
        context = lines.slice(start, end);

    var c;
    for (var i = 0, len = context.length; i < len; ++i) {
      c = i + start + 1;
      context[i] = (c === line ? " >> " : "    ") + context[i];
    }

    e.template = template;
    e.line = line;
    e.file = file;
    e.message = [file + ":" + line, context.join("\n"), "", e.message].join("\n");

    return e;
  }

  /**
   * Looks up the value of the given `name` in the given context `stack`.
   */
  function lookup(name, stack, defaultValue) {
    if (name === ".") {
      return stack[stack.length - 1];
    }

    var names = name.split(".");
    var lastIndex = names.length - 1;
    var target = names[lastIndex];

    var value, context, i = stack.length, j, localStack;
    while (i) {
      localStack = stack.slice(0);
      context = stack[--i];

      j = 0;
      while (j < lastIndex) {
        context = context[names[j++]];

        if (context == null) {
          break;
        }

        localStack.push(context);
      }

      if (context && typeof context === "object" && target in context) {
        value = context[target];
        break;
      }
    }

    // If the value is a function, call it in the current context.
    if (typeof value === "function") {
      value = value.call(localStack[localStack.length - 1]);
    }

    if (value == null)  {
      return defaultValue;
    }

    return value;
  }

  function renderSection(name, stack, callback, inverted) {
    var buffer = "";
    var value =  lookup(name, stack);

    if (inverted) {
      // From the spec: inverted sections may render text once based on the
      // inverse value of the key. That is, they will be rendered if the key
      // doesn't exist, is false, or is an empty list.
      if (value == null || value === false || (isArray(value) && value.length === 0)) {
        buffer += callback();
      }
    } else if (isArray(value)) {
      forEach(value, function (value) {
        stack.push(value);
        buffer += callback();
        stack.pop();
      });
    } else if (typeof value === "object") {
      stack.push(value);
      buffer += callback();
      stack.pop();
    } else if (typeof value === "function") {
      var scope = stack[stack.length - 1];
      var scopedRender = function (template) {
        return render(template, scope);
      };
      buffer += value.call(scope, callback(), scopedRender) || "";
    } else if (value) {
      buffer += callback();
    }

    return buffer;
  }

  /**
   * Parses the given `template` and returns the source of a function that,
   * with the proper arguments, will render the template. Recognized options
   * include the following:
   *
   *   - file     The name of the file the template comes from (displayed in
   *              error messages)
   *   - tags     An array of open and close tags the `template` uses. Defaults
   *              to the value of Mustache.tags
   *   - debug    Set `true` to log the body of the generated function to the
   *              console
   *   - space    Set `true` to preserve whitespace from lines that otherwise
   *              contain only a {{tag}}. Defaults to `false`
   */
  function parse(template, options) {
    options = options || {};

    var tags = options.tags || exports.tags,
        openTag = tags[0],
        closeTag = tags[tags.length - 1];

    var code = [
      'var buffer = "";', // output buffer
      "\nvar line = 1;", // keep track of source line number
      "\ntry {",
      '\nbuffer += "'
    ];

    var spaces = [],      // indices of whitespace in code on the current line
        hasTag = false,   // is there a {{tag}} on the current line?
        nonSpace = false; // is there a non-space char on the current line?

    // Strips all space characters from the code array for the current line
    // if there was a {{tag}} on it and otherwise only spaces.
    var stripSpace = function () {
      if (hasTag && !nonSpace && !options.space) {
        while (spaces.length) {
          code.splice(spaces.pop(), 1);
        }
      } else {
        spaces = [];
      }

      hasTag = false;
      nonSpace = false;
    };

    var sectionStack = [], updateLine, nextOpenTag, nextCloseTag;

    var setTags = function (source) {
      tags = trim(source).split(/\s+/);
      nextOpenTag = tags[0];
      nextCloseTag = tags[tags.length - 1];
    };

    var includePartial = function (source) {
      code.push(
        '";',
        updateLine,
        '\nvar partial = partials["' + trim(source) + '"];',
        '\nif (partial) {',
        '\n  buffer += render(partial,stack[stack.length - 1],partials);',
        '\n}',
        '\nbuffer += "'
      );
    };

    var openSection = function (source, inverted) {
      var name = trim(source);

      if (name === "") {
        throw debug(new Error("Section name may not be empty"), template, line, options.file);
      }

      sectionStack.push({name: name, inverted: inverted});

      code.push(
        '";',
        updateLine,
        '\nvar name = "' + name + '";',
        '\nvar callback = (function () {',
        '\n  return function () {',
        '\n    var buffer = "";',
        '\nbuffer += "'
      );
    };

    var openInvertedSection = function (source) {
      openSection(source, true);
    };

    var closeSection = function (source) {
      var name = trim(source);
      var openName = sectionStack.length != 0 && sectionStack[sectionStack.length - 1].name;

      if (!openName || name != openName) {
        throw debug(new Error('Section named "' + name + '" was never opened'), template, line, options.file);
      }

      var section = sectionStack.pop();

      code.push(
        '";',
        '\n    return buffer;',
        '\n  };',
        '\n})();'
      );

      if (section.inverted) {
        code.push("\nbuffer += renderSection(name,stack,callback,true);");
      } else {
        code.push("\nbuffer += renderSection(name,stack,callback);");
      }

      code.push('\nbuffer += "');
    };

    var sendPlain = function (source) {
      code.push(
        '";',
        updateLine,
        '\nbuffer += lookup("' + trim(source) + '",stack,"");',
        '\nbuffer += "'
      );
    };

    var sendEscaped = function (source) {
      code.push(
        '";',
        updateLine,
        '\nbuffer += escapeHTML(lookup("' + trim(source) + '",stack,""));',
        '\nbuffer += "'
      );
    };

    var line = 1, c, callback;
    for (var i = 0, len = template.length; i < len; ++i) {
      if (template.slice(i, i + openTag.length) === openTag) {
        i += openTag.length;
        c = template.substr(i, 1);
        updateLine = '\nline = ' + line + ';';
        nextOpenTag = openTag;
        nextCloseTag = closeTag;
        hasTag = true;

        switch (c) {
        case "!": // comment
          i++;
          callback = null;
          break;
        case "=": // change open/close tags, e.g. {{=<% %>=}}
          i++;
          closeTag = "=" + closeTag;
          callback = setTags;
          break;
        case ">": // include partial
          i++;
          callback = includePartial;
          break;
        case "#": // start section
          i++;
          callback = openSection;
          break;
        case "^": // start inverted section
          i++;
          callback = openInvertedSection;
          break;
        case "/": // end section
          i++;
          callback = closeSection;
          break;
        case "{": // plain variable
          closeTag = "}" + closeTag;
          // fall through
        case "&": // plain variable
          i++;
          nonSpace = true;
          callback = sendPlain;
          break;
        default: // escaped variable
          nonSpace = true;
          callback = sendEscaped;
        }

        var end = template.indexOf(closeTag, i);

        if (end === -1) {
          throw debug(new Error('Tag "' + openTag + '" was not closed properly'), template, line, options.file);
        }

        var source = template.substring(i, end);

        if (callback) {
          callback(source);
        }

        // Maintain line count for \n in source.
        var n = 0;
        while (~(n = source.indexOf("\n", n))) {
          line++;
          n++;
        }

        i = end + closeTag.length - 1;
        openTag = nextOpenTag;
        closeTag = nextCloseTag;
      } else {
        c = template.substr(i, 1);

        switch (c) {
        case '"':
        case "\\":
          nonSpace = true;
          code.push("\\" + c);
          break;
        case "\r":
          // Ignore carriage returns.
          break;
        case "\n":
          spaces.push(code.length);
          code.push("\\n");
          stripSpace(); // Check for whitespace on the current line.
          line++;
          break;
        default:
          if (isWhitespace(c)) {
            spaces.push(code.length);
          } else {
            nonSpace = true;
          }

          code.push(c);
        }
      }
    }

    if (sectionStack.length != 0) {
      throw debug(new Error('Section "' + sectionStack[sectionStack.length - 1].name + '" was not closed properly'), template, line, options.file);
    }

    // Clean up any whitespace from a closing {{tag}} that was at the end
    // of the template without a trailing \n.
    stripSpace();

    code.push(
      '";',
      "\nreturn buffer;",
      "\n} catch (e) { throw {error: e, line: line}; }"
    );

    // Ignore `buffer += "";` statements.
    var body = code.join("").replace(/buffer \+= "";\n/g, "");

    if (options.debug) {
      if (typeof console != "undefined" && console.log) {
        console.log(body);
      } else if (typeof print === "function") {
        print(body);
      }
    }

    return body;
  }

  /**
   * Used by `compile` to generate a reusable function for the given `template`.
   */
  function _compile(template, options) {
    var args = "view,partials,stack,lookup,escapeHTML,renderSection,render";
    var body = parse(template, options);
    var fn = new Function(args, body);

    // This anonymous function wraps the generated function so we can do
    // argument coercion, setup some variables, and handle any errors
    // encountered while executing it.
    return function (view, partials) {
      partials = partials || {};

      var stack = [view]; // context stack

      try {
        return fn(view, partials, stack, lookup, escapeHTML, renderSection, render);
      } catch (e) {
        throw debug(e.error, template, e.line, options.file);
      }
    };
  }

  // Cache of pre-compiled templates.
  var _cache = {};

  /**
   * Clear the cache of compiled templates.
   */
  function clearCache() {
    _cache = {};
  }

  /**
   * Compiles the given `template` into a reusable function using the given
   * `options`. In addition to the options accepted by Mustache.parse,
   * recognized options include the following:
   *
   *   - cache    Set `false` to bypass any pre-compiled version of the given
   *              template. Otherwise, a given `template` string will be cached
   *              the first time it is parsed
   */
  function compile(template, options) {
    options = options || {};

    // Use a pre-compiled version from the cache if we have one.
    if (options.cache !== false) {
      if (!_cache[template]) {
        _cache[template] = _compile(template, options);
      }

      return _cache[template];
    }

    return _compile(template, options);
  }

  /**
   * High-level function that renders the given `template` using the given
   * `view` and `partials`. If you need to use any of the template options (see
   * `compile` above), you must compile in a separate step, and then call that
   * compiled function.
   */
  function render(template, view, partials) {
    return compile(template)(view, partials);
  }

})(Mustache);
;
/* Common front-end code for the Notifications system
 *	- wpNotesCommon wraps all the proxied REST calls
 * 	- wpNoteModel & wpNoteList are Backbone.js Model, & Collection implementations
 */


var wpNotesCommon;
var wpNotesCommentModView;
var wpNoteList;
var wpNoteModel;

(function($){
	var cookies = document.cookie.split( /;\s*/ ), cookie = false;
	for ( i = 0; i < cookies.length; i++ ) {
		if ( cookies[i].match( /^wp_api=/ ) ) {
			cookies = cookies[i].split( '=' );
			cookie = cookies[1];
			break;
		}
	}

	wpNotesCommon = {
		noteTypes: {
			comment: 'comment',
			follow: 'follow',
			like: 'like',
			reblog: 'reblog',
			trophy: [
				'best_liked_day_feat',
				'like_milestone_achievement',
				'achieve_automattician_note',
				'best_followed_day_feat',
				'followed_milestone_achievement'
			],
			'alert': [
				'expired_domain_alert'
			]
		},

		noteType2Noticon: {
			'like': 'like',
			'follow': 'follow',
			'comment_like': 'like',
			'comment': 'comment',
			'reblog': 'reblog',
			'like_milestone_achievement': 'trophy',
			'achieve_followed_milestone_note': 'trophy',
			'best_liked_day_feat': 'milestone',
			'best_followed_day_feat': 'milestone',
			'automattician_achievement': 'trophy',
			'expired_domain_alert': 'alert'
		},
	
		createNoteContainer: function( note, id_prefix ) {
			var note_container = $('<div/>', {
				id : id_prefix + '-note-' + note.id,
				'class' : 'wpn-note wpn-' + note.type + ' ' + ( ( note.unread > 0 ) ? 'wpn-unread' : 'wpn-read' )
			}).data( {
				id: parseInt( note.id ),
				type: note.type
			});
			var note_body = $('<div/>', { "class":"wpn-note-body wpn-note-body-empty" } );
			var spinner = $( '<div/>', { style : 'position: absolute; left: 180px; top: 60px;' } );
			note_body.append( spinner );
			spinner.spin( 'medium' );
			note_container.append(
				this.createNoteSubject( note ),
				note_body
			);
	
			return note_container;
		},
	
		createNoteSubject: function( note ) {
			var subj = $('<div/>', { "class":"wpn-note-summary" } ).append(
				$('<span/>', {
					"class" : 'wpn-noticon',
						html : $('<img/>', {
							src : note.subject['noticon'],
							width : '14px',
							height : '14px',
							style : 'display: inline-block; width: 14px; height: 14px; overflow-x: hidden; overflow-y: hidden;'
						})
				}),
				$('<span/>', {
					"class" : 'wpn-icon no-grav',
						html : $('<img/>', {
							src : note.subject['icon'],
							width : '24px',
							height : '24px',
							style : 'display: inline-block; width: 24px; height: 24px; overflow-x: hidden; overflow-y: hidden;'
						})
				}),
				$('<span/>', {
				 	"class" : 'wpn-subject',
				 	html : note.subject['html']
				 })
			);
			return subj;
		},
	
	
		createNoteBody: function( note_model ) {
			var note_body = $('<div/>', { "class":"wpn-note-body" } );
			var note = note_model.toJSON();
			var class_prefix = 'wpn-' + note.body['template'];
			switch( note.body['template'] ) {
				case 'single-line-list' :
				case 'multi-line-list' :
					note_body.append( 
						$( '<p/>' ).addClass( class_prefix + '-header' ).html( note.body['header'] )
					);
	
					for ( i in note.body['items'] ) {
						var item = $('<div></div>', { 
							'class' : class_prefix + '-item ' + class_prefix + '-item-' + i + 
								( note.body['items'][i]['icon'] ? '' : ' ' + class_prefix + '-item-no-icon' )
						});
						if ( note.body['items'][i]['icon'] ) {
							item.append(
								$('<img/>', { 
									"class" : class_prefix + '-item-icon avatar avatar-' + note.body['items'][i]['icon_width'],
									height: note.body['items'][i]['icon_height'],
									width: note.body['items'][i]['icon_width'],
									src: note.body['items'][i]['icon']
							} ) );
						}
						if ( note.body['items'][i]['header'] ) {
							item.append(
								$('<div></div>', { 'class' : class_prefix + '-item-header' }
							 ).html( note.body['items'][i]['header'] ) );
						}
						if ( note.body['items'][i]['action'] ) {
							switch ( note.body['items'][i]['action']['type'] ) {
								case 'follow' :
									var button = wpFollowButton.create( note.body['items'][i]['action'] );
									item.append( button );
									// Attach action stat tracking for follows
									button.click( function(e) {
										if ( $( this ).children('a').hasClass( 'wpcom-follow-rest' ) )
											wpNotesCommon.bumpStat( 'notes-click-action', 'unfollow' );
										else
											wpNotesCommon.bumpStat( 'notes-click-action', 'follow' );
										return true;
									} );
									break;
								default :
									console.error( "Unsupported " + note.type + " action: " + note.body['items'][i]['action']['type'] );
									break;
							}
						}
						if ( note.body['items'][i]['html'] ) {
							item.append(
								$('<div></div>', { 'class' : class_prefix + '-item-body' }
							).html( note.body['items'][i]['html'] ) );
						}
						note_body.append( item );
					}
	
					if ( note.body['actions'] ) {
						var note_actions = new wpNotesCommentModView( { model: note_model } );
						var action_el = note_actions.create().el
						note_body.append( action_el );
					}
	
					if ( note.body['footer'] ) {
						note_body.append( 
							$( '<p/>' ).addClass( class_prefix + '-footer' ).html( note.body['footer'] )
						);
					}
					break;
				case 'big-badge' :
					if ( note.body['header'] ) {
						note_body.append( 
							$( '<div/>' ).addClass( class_prefix + '-header' ).html( note.body['header'] )
						);
					}
	
					if ( note.body['badge'] ) {
						note_body.append( $('<div></div>', { 
							'class' : class_prefix + '-badge ' 
						}).append( note.body['badge'] ) );
					}
	
					if ( note.body['html'] != '' ) {
						note_body.append( 
							$( '<div/>' ).addClass( class_prefix + '-footer' ).html( note.body['html'] )
						);
					}
	
					break;
				default :
					note_body.text( 'Unsupported note body template!' );
					break;
			}

			note_body.find( 'a[notes-data-click]' ).mousedown( function(e) {
				var type = $(this).attr( 'notes-data-click' );
				wpNotesCommon.bumpStat( 'notes-click-body', type );
				return true;
			} );
	
			return note_body;		
		},
	
		getNoteSubjects: function( query_params, success, fail ) {
			query_params.fields = 'id,type,unread,timestamp,subject';
			this.getNotes( query_params, success, fail );
		},

		//loads subject also so that body and subject are consistent
		getNoteBodies: function( ids, query_params, success, fail ) {
			var query_args = {};
			for ( i in ids ) {
				query_params['ids[' + i + ']'] = ids[i];
			}
	
			query_params.fields = 'id,subject,body';
			this.getNotes( query_params, success, fail );
		},
	
		getNotes: function( query_params, success, fail ) {
			this.ajax({
				type: 'GET',
				path : '/notifications/',
				data : query_params,
				success : success,
				error : fail
			});
		},
		
		markNotesSeen: function( timestamp ) {
			var query_args = { time: timestamp };

			this.ajax({
				type : 'POST',
				path : '/notifications/seen',
				data : query_args,
				success : function( res ) { },
				error : function( res ) { }
			});
		
			//var note_imps = query_args.length
			//this.bumpStat( 'notes-imps-type', note_imps );
		},
	
		markNotesRead: function( unread_cnts ) {
			var query_args = {};
			var t = this;

			for ( var id in unread_cnts ) {
				if ( unread_cnts[ id ] > 0 ) {
					query_args['counts[' + id + ']'] = unread_cnts[ id ];
				}
			}

			if ( 0 == query_args.length ) {
				return; //no unread notes
			}
			
			this.ajax({
				type : 'POST',
				path : '/notifications/read',
				data : query_args,
				success : function( res ) { },
				error : function( res ) { }
			});
		
			//var note_imps = query_args.length
			//this.bumpStat( 'notes-imps-type', note_imps );
		},

		ajax: function( options ) {
			if ( document.location.host == 'public-api.wordpress.com' ) {
				//console.log( 'regular ajax call ' + options.type + ' ' + options.path);
				var request = {
					type : options.type,
					headers : {'Authorization': 'X-WPCOOKIE ' + cookie + ':1:' + document.location.host },
					url : 'https://public-api.wordpress.com/rest/v1' + options.path,
					success : options.success,
					error : options.error,
					data : options.data
				};
				$.ajax(request);
			} else {
				//console.log( 'proxied ajax call ' + options.type + ' ' + options.path );
				var request = {
					path: options.path,
					method: options.type
				};
				if ( request.method === "POST" )
					request.body = options.data;
				else
					request.query = options.data;

				$.wpcom_proxy_request(request, function ( response, statusCode ) { 
					if ( 200 == statusCode ) 
						options.success( response );
					else
						options.error( statusCode );
				} );
			}
		},
	
		bumpStat: function( group, names ) {
			new Image().src = document.location.protocol + '//stats.wordpress.com/g.gif?v=wpcom-no-pv&x_' +
				group + '=' + names + '&baba=' + Math.random();
		},

		getKeycode: function( key_event ) {
			//determine if we can use this key event to trigger the menu
			key_event = key_event || window.event;
			if ( key_event.target )
				element = key_event.target;
			else if ( key_event.srcElement )
				element = key_event.srcElement;
			if( element.nodeType == 3 ) //text node, check the parent
				element = element.parentNode;
			
			if( key_event.ctrlKey == true || key_event.altKey == true || key_event.metaKey == true )
				return false;
		
			var keyCode = ( key_event.keyCode ) ? key_event.keyCode : key_event.which;

			if ( keyCode && ( element.tagName == 'INPUT' || element.tagName == 'TEXTAREA' ) )
				return false;

			return keyCode;
		}
	};

wpNoteModel = Backbone.Model.extend({
	defaults: {
		summary: "",
		unread: true
	},


	initialize: function() {			
		if ( typeof( this.get( "subject" ) ) !== "object"  ) {
			// @todo delete note from collection
			console.error("old style note. id# " + this.id );
		}
	},
		
	markRead: function() {
		var unread_cnt = this.get( 'unread' );
		if ( Boolean( parseInt( unread_cnt ) ) ) {
			var notes = {};
			notes[ this.id ] = unread_cnt;
			wpNotesCommon.markNotesRead( notes );
			wpNotesCommon.bumpStat( 'notes-read-type', this.get( 'type' ) );
		}
	},
	
	loadBody: function() {
		wpNotesCommon.createNoteBody( this );
	},

	reload: function() {
		var t = this;
		var fields = 'id,type,unread,subject,body,date,timestamp';
		var ids = this.get('id');

		wpNotesCommon.getNotes( {
			fields: fields,
			ids: ids
		}, function ( res ) {
			var notes = res.notes;
			if ( typeof notes[0] !== 'undefined' ) {
				t.set( notes[ 0 ] );
			}
		}, function() { 
			//ignore failure
		} );
	},

	resize: function() {
		this.trigger( 'resize' );
	}
});

wpNoteList = Backbone.Collection.extend({
	model:   wpNoteModel,
	lastMarkedSeenTimestamp : false,
	mostRecentTimestamp : false,
	newNotes: false,
	maxNotes : false,
	loading: false,
	bodiesLoaded: false,

	//always sort by timpstamp
	comparator: function( note ) {
 		return -note.get( 'timestamp' );
	},

	initialize: function() {
		if ( !this.lastMarkedSeenTimestamp && "undefined" != typeof( wpn_last_marked_seen_preloaded ) ){
			this.lastMarkedSeenTimestamp = parseInt( wpn_last_marked_seen_preloaded );
		}
		
	},

	addNotes: function( notes ) {
		var models = _.map( notes, function(o) { return new wpNoteModel(o); });
		this.add( models );
		this.sort(); //ensure we maintain sorted order
		if ( this.maxNotes ) {
			while( this.length > this.maxNotes ) {
				this.pop();
			}
		}
		if ( this.length > 0 )
			this.mostRecentTimestamp = parseInt( this.at(0).get('timestamp') );
		this.trigger( 'loadNotes:change' );
	},

	// load notes from the server
	loadNotes: function( query_args ) {
		var t = this;

		t.loading = true;
		t.trigger( 'loadNotes:beginLoading' );
		
		var fields = query_args.fields;
		var number = parseInt( query_args.number );
		var before = parseInt( query_args.before );
		var since = parseInt( query_args.since );
		var type = 'undefined' == typeof query_args.type ? null : query_args.type;
		var unread = 'undefined' == typeof query_args.unread ? null : query_args.unread;

		query_args = {};
		
		if ( ! fields ) {
			fields = 'id,type,unread,subject,body,date,timestamp';
		}
		
		if ( isNaN( number ) ) {
			number = 9;
		}
		
		if ( ! isNaN( before ) ) {
			query_args[ "before" ] = before;
		}
		if ( ! isNaN( since ) ) {
			query_args[ "since" ] = since;
		}

		if ( unread !== null ) {
			query_args[ "unread" ] = unread;
		}

		if ( type !== null && type != "unread" && type != "latest" ) {
			query_args[ "type" ] = type;
		}
		
		query_args[ "number" ] = number;
		query_args[ "fields" ] = fields;

		wpNotesCommon.getNotes( query_args, function ( res ) {
			var notes = res.notes;
			var notes_changed = false;
			if ( !t.lastMarkedSeenTimestamp || ( res.last_seen_time > t.lastMarkedSeenTimestamp ) ) { 
				notes_changed = true; 
				t.lastMarkedSeenTimestamp = parseInt( res.last_seen_time );
			} 

			for( var idx in notes ) {
				var note_model = t.get( notes[idx].id );
				if ( note_model ) {
					if ( type ) {
						var qt = note_model.get( 'queried_types' ) || {};
						qt[ type ] = true;
						notes[idx].queried_types = qt;
					}
					note_model.set( notes[ idx ] );
				}
				else {
					if ( type ) {
						var qt = {};
						qt[ type ] = true;
						notes[idx].queried_types = qt;
					}
					note_model = new wpNoteModel( notes[ idx ] )
					t.add( note_model );
				}
				if ( ! note_model.has('body') )
					t.bodiesLoaded = false;
				notes_changed = true;
			}

			if ( t.maxNotes ) {
				while( t.length > t.maxNotes ) {
					t.pop();
				}
			}

			if ( notes_changed ) {
				t.sort(); //ensure we maintain sorted order
				if ( t.length > 0 )
					t.mostRecentTimestamp = parseInt( t.at(0).get('timestamp') );
				t.trigger( 'loadNotes:change' );
			}
			t.loading = false;
			t.trigger( 'loadNotes:endLoading' );
		}, function(res) {
			t.loading = false;
			//ignore failure
		} );
	},

	loadNoteBodies: function(callback) {
		if ( this.bodiesLoaded )
			return;
		var t = this;

		//TODO: only load the notes that need to be reloaded
		wpNotesCommon.getNoteBodies( this.getNoteIds(), {}, function ( res ) {
			var notes = res.notes;
			for( var idx in notes ) {
				var note_model = t.get( notes[idx].id );
				if ( note_model ) {
					note_model.set( { body: notes[idx].body, subject: notes[idx].subject } );
				} else {
					note_model = new wpNoteModel( notes[ idx ] )
					t.add( note_model );
				}
			}
			t.bodiesLoaded = true;
			if ( typeof callback == "function" )
				callback.call(t);
		}, function (e) {
			console.error( 'body loading error!' );
		} );
		
	},

	markNotesSeen: function() {
		if ( this.mostRecentTimestamp > this.lastMarkedSeenTimestamp ) {
			wpNotesCommon.markNotesSeen( this.mostRecentTimestamp );
			this.lastMarkedSeenTimestamp = false;
		}
	},

	unreadCount: function() {
		return this.reduce( function( num, note ) { return num + ( note.get('unread') ? 1 : 0 ); }, 0 );
	},

	numberNewNotes: function() {
		var t = this;
		if ( ! t.lastMarkedSeenTimestamp )
			return 0;
		var new_notes = this.filter( function( note ) { 
			return ( note.get('timestamp') > t.lastMarkedSeenTimestamp ); 
		} );
		return new_notes.length;
	},

	// get all unread notes in the collection
	getUnreadNotes: function() {
		return this.filter( function( note ){ return Boolean( parseInt( note.get( "unread" ) ) ); } );
	},
	
	// get all notes in the collection of specified type
	getNotesOfType: function( typeName ) {
		var t = this;
		switch( typeName ){
			case 'unread':
				return t.getUnreadNotes();
				break;
			case 'latest':
				return t.filter( function( note ) {
					var qt = note.get( 'queried_types' );
					return 'undefined' != typeof qt && 'undefined' != typeof qt.latest && qt.latest;
				});
				break;
			default:
				return t.filter( function( note ) {
					var note_type = note.get( "type" );
					if ( "undefined" == typeof wpNotesCommon.noteTypes[ typeName ] ) {
						return false;
					}
					else if ( "string" == typeof wpNotesCommon.noteTypes[ typeName ] ) {
						return typeName == note_type;
					}
					var len = wpNotesCommon.noteTypes[ typeName ].length;
					for ( var i=0; i<len; i++ ){
						if ( wpNotesCommon.noteTypes[ typeName ][i] == note_type ) {
							return true;
						}
					}
					return false;
				} );
		}
	},

	getNoteIds: function() {
		return this.pluck( 'id' );
	}
});

wpNotesCommentModView = Backbone.View.extend({
	mode: 'buttons', //buttons, reply
	commentNeedsApproval : false,
	actionIDMap : {},

	events: {},

	templateApproveButton: '\
		<span class="{{class_name}}">\
			<a href="{{ajax_url}}" title="{{title_text}} Keyboard shortcut: {{keytext}}" data-action-type="{{data_action_type}}"><b>{{text}}</b></a>\
		</span>\
	',
	templateButton: '\
		<span class="{{class_name}}">\
			<a href="{{ajax_url}}" title="{{title_text}} Keyboard shortcut: {{keytext}}" data-action-type="{{data_action_type}}">{{text}}</a>\
		</span>\
	',

	templateReply: '\
		<div class="wpn-note-comment-reply"> \
			<h5>{{reply_header_text}}</h5>\
			<textarea class="wpn-note-comment-reply-text" rows="5" cols="45" name="wpn-note-comment-reply-text"></textarea>\
			<p class="wpn-comment-submit">\
				<span class="wpn-comment-submit-waiting" style="display: none;"></span>\
			<span class="wpn-comment-submit-error" style="display:none;">Error!</span>\
			<a href="{{ajax_url}}" class="wpn-comment-reply-button-send alignright">{{submit_button_text}}</a>\
			<a href="" class="wpn-comment-reply-button-close alignleft">_</a>\
			</p>\
		</div>\
	',

	initialize : function() {
		var t = this;
		_.bindAll( this, 'render' );
		if ( ! this.model.currentReplyText )
			this.model.currentReplyText = '';

		$(document).keydown(function ( key_event ) {
			if ( t.$el.is( ':hidden' ) ) {
				return;
			}

			if ( t.mode != 'buttons' ) {
				return;
			}

			var keyCode = wpNotesCommon.getKeycode( key_event );
			if ( !keyCode ) {
				return;
			}

			if ( keyCode == 82 ) { //r = reply to comment
				if ( typeof t.actionIDMap[ 'replyto-comment' ] != 'undefined' )
					t.openReply( key_event );
				return false; //prevent default
			}
			if ( keyCode == 65 ) { //a = approve/unapprove comment
				if ( typeof t.actionIDMap[ 'approve-comment' ] != 'undefined' )
					t.modComment( 'approve-comment' );
				else if ( typeof t.actionIDMap[ 'unapprove-comment' ] != 'undefined' )
					t.modComment( 'unapprove-comment' );
				return false; //prevent default
			}
			if ( keyCode == 83 ) { //s = spam/unspam comment
				if ( typeof t.actionIDMap[ 'spam-comment' ] != 'undefined' )
					t.modComment( 'spam-comment' );
				else if ( typeof t.actionIDMap[ 'unspam-comment' ] != 'undefined' )
					t.modComment( 'unspam-comment' );
				return false; //prevent default
			}
			if ( keyCode == 84 ) { //t = trash/untrash comment
				if ( typeof t.actionIDMap[ 'trash-comment' ] != 'undefined' )
					t.modComment( 'trash-comment' );
				else if ( typeof t.actionIDMap[ 'untrash-comment' ] != 'undefined' )
					t.modComment( 'untrash-comment' );
				return false; //prevent default
			}

		});

	},

	create: function() {
		this.setElement( $( '<div></div>', { 'class': 'wpn-note-comment-actions' } ) );

		this.events['click .wpn-replyto-comment-button-open a'] = 'openReply';
		this.events['click .wpn-comment-reply-button-close'] = 'closeReply';
		this.events['click .wpn-comment-reply-button-send'] = 'sendReply';
		this.events['click .wpn-approve-comment-button a'] = 'clickModComment';
		this.events['click .wpn-unapprove-comment-button a'] = 'clickModComment';
		this.events['click .wpn-spam-comment-button a'] = 'clickModComment';
		this.events['click .wpn-unspam-comment-button a'] = 'clickModComment';
		this.events['click .wpn-trash-comment-button a'] = 'clickModComment';
		this.events['click .wpn-untrash-comment-button a'] = 'clickModComment';

		this.model.bind( 'change', this.render, this );

		this.render();
		
		return this;
	},

	render: function() {
		this.$el.empty();
		if ( this.mode == 'buttons' ) {
			this.$el.append.apply( this.$el, this.createActions() );
		} else {
			this.$el.html( this.createReplyBox() );
			this.$( 'textarea' ).focus();
		}
		this.delegateEvents();
	},

	createActions: function() {
		var actions = this.model.get('body').actions;
		var t = this;
		var elements = [];
		this.actionIDMap = {};

		var cnt = 0;
		_.forEach( actions, function( action ) {
			t.actionIDMap[ action.type ] = cnt;
			switch( action['type'] ) {
				case 'replyto-comment':
					var keytext = '[r]';
					elements.push( Mustache.render( t.templateButton, {
						class_name: 'wpn-' + action.type + '-button-open',
						ajax_url: action.params.url,
						title_text: action.params.button_title_text,
						data_action_type: action.type,
						text: action.params.button_text,
						keytext: keytext
					} ) );
					elements.push( ' | ' );
					break;
				case 'approve-comment':
					var keytext = '[a]';
					t.commentNeedsApproval = true;
					elements.push( Mustache.render( t.templateApproveButton, {
						class_name: 'wpn-' + action.type + '-button',
						ajax_url: action.params.url,
						title_text: action.params.title_text,
						data_action_type: action.type,
						text: action.params.text,
						keytext: keytext
					} ) );
					elements.push( ' | ' );
					break;
				case 'unapprove-comment':
					var keytext = '[a]';
				case 'spam-comment':
					var keytext = ( typeof keytext == 'undefined' ) ? '[s]' : keytext;
				case 'unspam-comment':
					var keytext = ( typeof keytext == 'undefined' ) ? '[s]' : keytext;
				case 'trash-comment':
					var keytext = ( typeof keytext == 'undefined' ) ? '[t]' : keytext;
				case 'untrash-comment':
					var keytext = ( typeof keytext == 'undefined' ) ? '[t]' : keytext;
					elements.push( Mustache.render( t.templateButton, {
						class_name: 'wpn-' + action.type + '-button',
						ajax_url: action.params.url,
						title_text: action.params.title_text,
						data_action_type: action.type,
						text: action.params.text,
						keytext: keytext
					} ) );
					elements.push( ' | ' );
					break;
			}
			cnt += 1;
		});

		//remove final " | "
		elements = elements.slice( 0, -1 );
		elements.push( $( '<span/>', {
			'class': "wpn-comment-mod-waiting",
			style: "display:none;"
		} ) );

		return elements;
	},

	createReplyBox : function() {
		var action = this.model.get('body').actions[ this.actionIDMap['replyto-comment'] ];
		var element =  Mustache.render( this.templateReply, {
			ajax_url: action.params.url,
			reply_header_text: action.params.reply_header_text,
			submit_button_text: action.params.submit_button_text
		} );

		return element;
	},

	closeReply : function( ev ) {
		if ( ev )
			ev.preventDefault()
		this.mode = 'buttons';
		this.model.currentReplyText = this.$el.children( '.wpn-note-comment-reply' ).children( '.wpn-note-comment-reply-text' ).val();
		this.render();
		this.model.resize();
	},

	openReply : function( ev ) {
		ev.preventDefault()
		this.mode = 'reply';
		this.render();
		this.$el.children( '.wpn-note-comment-reply' ).children( '.wpn-note-comment-reply-text' ).val( this.model.currentReplyText );
		this.model.resize();
	},

	sendReply : function( ev ) {
		ev.preventDefault()
		var t = this;
		var comment_reply_el = this.$el.children( '.wpn-note-comment-reply' );
		var comment_text = comment_reply_el.children( '.wpn-note-comment-reply-text' ).val();
		this.model.currentReplyText = comment_text;
		var action = this.model.get('body').actions[ this.actionIDMap['replyto-comment'] ];
		
		comment_reply_el.children( '.wpn-comment-submit' ).children( '.wpn-comment-submit-error').hide();
		comment_reply_el.children( '.wpn-comment-submit' ).children( '.wpn-comment-submit-waiting').show();

		var args = {};
		if ( this.commentNeedsApproval )
			args.approve_parent = '1';

		args.comment_ID = action.params.comment_id;
		args.comment_post_ID = action.params.post_id;
		args.user_ID = action.params.user_id;
		args.blog_id = action.params.blog_id;
		args.action = 'replyto_comment_note';
		args['_wpnonce'] = action.params.replyto_nonce;
		args.content = comment_text;

		$.ajax({
			type : 'POST',
			url : action.params.ajax_url,
			data : args,
			success : function(x) { 
				if ( typeof(x) == 'string' ) {
					t.errorReply( {'responseText': x} );
					return false;
				}
				t.model.currentReplyText = '';
				t.closeReply( null );
				t.model.reload();
			},
			error : function(r) { 
				t.errorReply(r); 
			}
		});

		wpNotesCommon.bumpStat( 'notes-click-action', 'replyto-comment' );

		$('.wpn-comment-submit-waiting').spin( 'small' );
	},

	errorReply : function(r) {
		var t = this;
		var er = r.statusText;
		var comment_reply_el = this.$el.children( '.wpn-note-comment-reply' );

		comment_reply_el.children( '.wpn-comment-submit' ).children( '.wpn-comment-submit-waiting').hide();

		if ( r.responseText )
			er = r.responseText.replace( /<.[^<>]*?>/g, '' );

		if ( er )
			comment_reply_el.children( '.wpn-comment-submit' ).children( '.wpn-comment-submit-error').text(er).show();
	},

	clickModComment : function( ev ) {
		var t = this;
		ev.preventDefault()
		var type = ev.currentTarget.getAttribute('data-action-type');
		t.modComment( type );
	},

	modComment : function( type ) {
		var t = this;
		var action_id = this.actionIDMap[type];

		if ( typeof action_id !== 'undefined' ) {
			var action = this.model.get('body').actions[ action_id ];
			var data = {
				'id' : action.params.comment_id,
				'action' : action.params.ajax_action,
				'blog_id' : action.params.blog_id,
				'_blog_nonce' : action.params.blog_nonce,
				'_wpnonce' : action.params._wpnonce
			};
			data[ action.params.ajax_arg ] = 1;

			this.$( ' .wpn-comment-mod-waiting' ).show();

			$.post( action.params.ajax_url, data,
		 		function (res) { 
					t.model.reload();
			});
			wpNotesCommon.bumpStat( 'notes-click-action', type );

			$('.wpn-comment-mod-waiting').spin( 'small' );

		}
	}
});


})(jQuery);
;
/**
 The MIT License

 Copyright (c) 2010 Daniel Park (http://metaweb.com, http://postmessage.freebaseapps.com)

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 **/
var NO_JQUERY = {};
(function(window, $, undefined) {

     if (!("console" in window)) {
         var c = window.console = {};
         c.log = c.warn = c.error = c.debug = function(){};
     }

     if ($ === NO_JQUERY) {
         // jQuery is optional
         $ = {
             fn: {},
             extend: function() {
                 var a = arguments[0];
                 for (var i=1,len=arguments.length; i<len; i++) {
                     var b = arguments[i];
                     for (var prop in b) {
                         a[prop] = b[prop];
                     }
                 }
                 return a;
             }
         };
     }

     $.fn.pm = function() {
         console.log("usage: \nto send:    $.pm(options)\nto receive: $.pm.bind(type, fn, [origin])");
         return this;
     };

     // send postmessage
     $.pm = window.pm = function(options) {
         pm.send(options);
     };

     // bind postmessage handler
     $.pm.bind = window.pm.bind = function(type, fn, origin, hash, async_reply) {
         pm.bind(type, fn, origin, hash, async_reply === true);
     };

     // unbind postmessage handler
     $.pm.unbind = window.pm.unbind = function(type, fn) {
         pm.unbind(type, fn);
     };

     // default postmessage origin on bind
     $.pm.origin = window.pm.origin = null;

     // default postmessage polling if using location hash to pass postmessages
     $.pm.poll = window.pm.poll = 200;

     var pm = {

         send: function(options) {
             var o = $.extend({}, pm.defaults, options),
             target = o.target;
             if (!o.target) {
                 console.warn("postmessage target window required");
                 return;
             }
             if (!o.type) {
                 console.warn("postmessage type required");
                 return;
             }
             var msg = {data:o.data, type:o.type};
             if (o.success) {
                 msg.callback = pm._callback(o.success);
             }
             if (o.error) {
                 msg.errback = pm._callback(o.error);
             }
             if (("postMessage" in target) && !o.hash) {
                 pm._bind();
                 target.postMessage(JSON.stringify(msg), o.origin || '*');
             }
             else {
                 pm.hash._bind();
                 pm.hash.send(o, msg);
             }
         },

         bind: function(type, fn, origin, hash, async_reply) {
           pm._replyBind ( type, fn, origin, hash, async_reply );
         },
       
         _replyBind: function(type, fn, origin, hash, isCallback) {
           if (("postMessage" in window) && !hash) {
               pm._bind();
           }
           else {
               pm.hash._bind();
           }
           var l = pm.data("listeners.postmessage");
           if (!l) {
               l = {};
               pm.data("listeners.postmessage", l);
           }
           var fns = l[type];
           if (!fns) {
               fns = [];
               l[type] = fns;
           }
           fns.push({fn:fn, callback: isCallback, origin:origin || $.pm.origin});
         },

         unbind: function(type, fn) {
             var l = pm.data("listeners.postmessage");
             if (l) {
                 if (type) {
                     if (fn) {
                         // remove specific listener
                         var fns = l[type];
                         if (fns) {
                             var m = [];
                             for (var i=0,len=fns.length; i<len; i++) {
                                 var o = fns[i];
                                 if (o.fn !== fn) {
                                     m.push(o);
                                 }
                             }
                             l[type] = m;
                         }
                     }
                     else {
                         // remove all listeners by type
                         delete l[type];
                     }
                 }
                 else {
                     // unbind all listeners of all type
                     for (var i in l) {
                       delete l[i];
                     }
                 }
             }
         },

         data: function(k, v) {
             if (v === undefined) {
                 return pm._data[k];
             }
             pm._data[k] = v;
             return v;
         },

         _data: {},

         _CHARS: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split(''),

         _random: function() {
             var r = [];
             for (var i=0; i<32; i++) {
                 r[i] = pm._CHARS[0 | Math.random() * 32];
             };
             return r.join("");
         },

         _callback: function(fn) {
             var cbs = pm.data("callbacks.postmessage");
             if (!cbs) {
                 cbs = {};
                 pm.data("callbacks.postmessage", cbs);
             }
             var r = pm._random();
             cbs[r] = fn;
             return r;
         },

         _bind: function() {
             // are we already listening to message events on this w?
             if (!pm.data("listening.postmessage")) {
                 if (window.addEventListener) {
                     window.addEventListener("message", pm._dispatch, false);
                 }
                 else if (window.attachEvent) {
                     window.attachEvent("onmessage", pm._dispatch);
                 }
                 pm.data("listening.postmessage", 1);
             }
         },

         _dispatch: function(e) {
             //console.log("$.pm.dispatch", e, this);
             try {
                 var msg = JSON.parse(e.data);
             }
             catch (ex) {
                 //console.warn("postmessage data invalid json: ", ex); //message wasn't meant for pm
                 return;
             }
             if (!msg.type) {
                 //console.warn("postmessage message type required"); //message wasn't meant for pm
                 return;
             }
             var cbs = pm.data("callbacks.postmessage") || {},
             cb = cbs[msg.type];
             if (cb) {
                 cb(msg.data);
             }
             else {
                 var l = pm.data("listeners.postmessage") || {};
                 var fns = l[msg.type] || [];
                 for (var i=0,len=fns.length; i<len; i++) {
                     var o = fns[i];
                     if (o.origin && o.origin !== '*' && e.origin !== o.origin) {
                         console.warn("postmessage message origin mismatch", e.origin, o.origin);
                         if (msg.errback) {
                             // notify post message errback
                             var error = {
                                 message: "postmessage origin mismatch",
                                 origin: [e.origin, o.origin]
                             };
                             pm.send({target:e.source, data:error, type:msg.errback});
                         }
                         continue;
                     }

                     function sendReply ( data ) {
                       if (msg.callback) {
                           pm.send({target:e.source, data:data, type:msg.callback});
                       }
                     }
                     
                     try {
                         if ( o.callback ) {
                           o.fn(msg.data, sendReply, e);
                         } else {
                           sendReply ( o.fn(msg.data, e) );
                         }
                     }
                     catch (ex) {
                         if (msg.errback) {
                             // notify post message errback
                             pm.send({target:e.source, data:ex, type:msg.errback});
                         } else {
                             throw ex;
                         }
                     }
                 };
             }
         }
     };

     // location hash polling
     pm.hash = {

         send: function(options, msg) {
             //console.log("hash.send", target_window, options, msg);
             var target_window = options.target,
             target_url = options.url;
             if (!target_url) {
                 console.warn("postmessage target window url is required");
                 return;
             }
             target_url = pm.hash._url(target_url);
             var source_window,
             source_url = pm.hash._url(window.location.href);
             if (window == target_window.parent) {
                 source_window = "parent";
             }
             else {
                 try {
                     for (var i=0,len=parent.frames.length; i<len; i++) {
                         var f = parent.frames[i];
                         if (f == window) {
                             source_window = i;
                             break;
                         }
                     };
                 }
                 catch(ex) {
                     // Opera: security error trying to access parent.frames x-origin
                     // juse use window.name
                     source_window = window.name;
                 }
             }
             if (source_window == null) {
                 console.warn("postmessage windows must be direct parent/child windows and the child must be available through the parent window.frames list");
                 return;
             }
             var hashmessage = {
                 "x-requested-with": "postmessage",
                 source: {
                     name: source_window,
                     url: source_url
                 },
                 postmessage: msg
             };
             var hash_id = "#x-postmessage-id=" + pm._random();
             target_window.location = target_url + hash_id + encodeURIComponent(JSON.stringify(hashmessage));
         },

         _regex: /^\#x\-postmessage\-id\=(\w{32})/,

         _regex_len: "#x-postmessage-id=".length + 32,

         _bind: function() {
             // are we already listening to message events on this w?
             if (!pm.data("polling.postmessage")) {
                 setInterval(function() {
                                 var hash = "" + window.location.hash,
                                 m = pm.hash._regex.exec(hash);
                                 if (m) {
                                     var id = m[1];
                                     if (pm.hash._last !== id) {
                                         pm.hash._last = id;
                                         pm.hash._dispatch(hash.substring(pm.hash._regex_len));
                                     }
                                 }
                             }, $.pm.poll || 200);
                 pm.data("polling.postmessage", 1);
             }
         },

         _dispatch: function(hash) {
             if (!hash) {
                 return;
             }
             try {
                 hash = JSON.parse(decodeURIComponent(hash));
                 if (!(hash['x-requested-with'] === 'postmessage' &&
                       hash.source && hash.source.name != null && hash.source.url && hash.postmessage)) {
                     // ignore since hash could've come from somewhere else
                     return;
                 }
             }
             catch (ex) {
                 // ignore since hash could've come from somewhere else
                 return;
             }
             var msg = hash.postmessage,
             cbs = pm.data("callbacks.postmessage") || {},
             cb = cbs[msg.type];
             if (cb) {
                 cb(msg.data);
             }
             else {
                 var source_window;
                 if (hash.source.name === "parent") {
                     source_window = window.parent;
                 }
                 else {
                     source_window = window.frames[hash.source.name];
                 }
                 var l = pm.data("listeners.postmessage") || {};
                 var fns = l[msg.type] || [];
                 for (var i=0,len=fns.length; i<len; i++) {
                     var o = fns[i];
                     if (o.origin) {
                         var origin = /https?\:\/\/[^\/]*/.exec(hash.source.url)[0];
                         if (o.origin !== '*' && origin !== o.origin) {
                             console.warn("postmessage message origin mismatch", origin, o.origin);
                             if (msg.errback) {
                                 // notify post message errback
                                 var error = {
                                     message: "postmessage origin mismatch",
                                     origin: [origin, o.origin]
                                 };
                                 pm.send({target:source_window, data:error, type:msg.errback, hash:true, url:hash.source.url});
                             }
                             continue;
                         }
                     }

                     function sendReply ( data ) {
                       if (msg.callback) {
                         pm.send({target:source_window, data:data, type:msg.callback, hash:true, url:hash.source.url});
                       }
                     }
                     
                     try {
                         if ( o.callback ) {
                           o.fn(msg.data, sendReply);
                         } else {
                           sendReply ( o.fn(msg.data) );
                         }
                     }
                     catch (ex) {
                         if (msg.errback) {
                             // notify post message errback
                             pm.send({target:source_window, data:ex, type:msg.errback, hash:true, url:hash.source.url});
                         } else {
                             throw ex;
                         }
                     }
                 };
             }
         },

         _url: function(url) {
             // url minus hash part
             return (""+url).replace(/#.*$/, "");
         }

     };

     $.extend(pm, {
                  defaults: {
                      target: null,  /* target window (required) */
                      url: null,     /* target window url (required if no window.postMessage or hash == true) */
                      type: null,    /* message type (required) */
                      data: null,    /* message data (required) */
                      success: null, /* success callback (optional) */
                      error: null,   /* error callback (optional) */
                      origin: "*",   /* postmessage origin (optional) */
                      hash: false    /* use location hash for message passing (optional) */
                  }
              });

 })(this, typeof jQuery === "undefined" ? NO_JQUERY : jQuery);

/**
 * http://www.JSON.org/json2.js
 **/
if (! ("JSON" in window && window.JSON)){JSON={}}(function(){function f(n){return n<10?"0"+n:n}if(typeof Date.prototype.toJSON!=="function"){Date.prototype.toJSON=function(key){return this.getUTCFullYear()+"-"+f(this.getUTCMonth()+1)+"-"+f(this.getUTCDate())+"T"+f(this.getUTCHours())+":"+f(this.getUTCMinutes())+":"+f(this.getUTCSeconds())+"Z"};String.prototype.toJSON=Number.prototype.toJSON=Boolean.prototype.toJSON=function(key){return this.valueOf()}}var cx=/[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,escapable=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,gap,indent,meta={"\b":"\\b","\t":"\\t","\n":"\\n","\f":"\\f","\r":"\\r",'"':'\\"',"\\":"\\\\"},rep;function quote(string){escapable.lastIndex=0;return escapable.test(string)?'"'+string.replace(escapable,function(a){var c=meta[a];return typeof c==="string"?c:"\\u"+("0000"+a.charCodeAt(0).toString(16)).slice(-4)})+'"':'"'+string+'"'}function str(key,holder){var i,k,v,length,mind=gap,partial,value=holder[key];if(value&&typeof value==="object"&&typeof value.toJSON==="function"){value=value.toJSON(key)}if(typeof rep==="function"){value=rep.call(holder,key,value)}switch(typeof value){case"string":return quote(value);case"number":return isFinite(value)?String(value):"null";case"boolean":case"null":return String(value);case"object":if(!value){return"null"}gap+=indent;partial=[];if(Object.prototype.toString.apply(value)==="[object Array]"){length=value.length;for(i=0;i<length;i+=1){partial[i]=str(i,value)||"null"}v=partial.length===0?"[]":gap?"[\n"+gap+partial.join(",\n"+gap)+"\n"+mind+"]":"["+partial.join(",")+"]";gap=mind;return v}if(rep&&typeof rep==="object"){length=rep.length;for(i=0;i<length;i+=1){k=rep[i];if(typeof k==="string"){v=str(k,value);if(v){partial.push(quote(k)+(gap?": ":":")+v)}}}}else{for(k in value){if(Object.hasOwnProperty.call(value,k)){v=str(k,value);if(v){partial.push(quote(k)+(gap?": ":":")+v)}}}}v=partial.length===0?"{}":gap?"{\n"+gap+partial.join(",\n"+gap)+"\n"+mind+"}":"{"+partial.join(",")+"}";gap=mind;return v}}if(typeof JSON.stringify!=="function"){JSON.stringify=function(value,replacer,space){var i;gap="";indent="";if(typeof space==="number"){for(i=0;i<space;i+=1){indent+=" "}}else{if(typeof space==="string"){indent=space}}rep=replacer;if(replacer&&typeof replacer!=="function"&&(typeof replacer!=="object"||typeof replacer.length!=="number")){throw new Error("JSON.stringify")}return str("",{"":value})}}if(typeof JSON.parse!=="function"){JSON.parse=function(text,reviver){var j;function walk(holder,key){var k,v,value=holder[key];if(value&&typeof value==="object"){for(k in value){if(Object.hasOwnProperty.call(value,k)){v=walk(value,k);if(v!==undefined){value[k]=v}else{delete value[k]}}}}return reviver.call(holder,key,value)}cx.lastIndex=0;if(cx.test(text)){text=text.replace(cx,function(a){return"\\u"+("0000"+a.charCodeAt(0).toString(16)).slice(-4)})}if(/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,"@").replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,"]").replace(/(?:^|:|,)(?:\s*\[)+/g,""))){j=eval("("+text+")");return typeof reviver==="function"?walk({"":j},""):j}throw new SyntaxError("JSON.parse")}}}());
;
var wpNotesToolbarClient;

(function($) {

var wpntView = Backbone.View.extend({
	el: '#wp-admin-bar-notes',
	count: null,
	origin: document.location.hash.replace(/^#/, ''),

	initialize: function() {
		var t = this;
		this.notesList = new wpNoteList();
		this.notesList.maxNotes = 9;
		this.notesListView = new wptNoteSubjectListView( { model: this.notesList } );
		this.notesList.bind('loadNotes:change', this.render, this);

		$(document).bind( "mousedown focus", function(e) {
			// Firefox: don't hide on all clicks
			if ( e.target === document )
				return true;
			// Don't hide on clicks in the panel.
			if ( $(e.target).closest('#wp-admin-bar-notes').length )
				return true;
			t.hidePanel();
		});

		$(document).keydown(function (e) {
			if ( !t.showingPanel )
				return;

			var keyCode = wpNotesCommon.getKeycode( e );
			if ( !keyCode )
				return;

			if ( ( keyCode == 27 ) || ( keyCode == 78 ) ) { //ESC, n
				t.postMessage( { action: 'togglePanel' } );
			}
			if ( ( keyCode == 74 ) || ( keyCode == 40  ) ) { //j and down arrow
				t.notesListView.selectNextNote();
				return false; //prevent default
			}
			if ( ( keyCode == 75 ) || ( keyCode == 38 ) ) { //k and up arrow
				t.notesListView.selectPrevNote();
				return false; //prevent default
			}
		});

		pm.bind( 'notesIframeMessage', function(e){t.handleEvent(e);} );
		this.postMessage( { action: 'iFrameReady' } );
		if ( window == top ) {
			this.notesList.loadNoteBodies();
			this.notesListView.reset();
		}
	},

	/* Done this way, "this" refers to the object instead of the window. */
	handleEvent: function( event ) {
		if ( "undefined" == typeof event.action )
			return;
		switch ( event.action ) {
			case "togglePanel":
				this.showingPanel = event.showing;
				this.togglePanel();
				break;
			case "refreshNotes":
				this.notesListView.refreshNotes();
				break;
			case "selectNextNote":
				this.notesListView.selectNextNote();
				break;
			case "selectPrevNote":
				this.notesListView.selectPrevNote();
				break;
			case "keyEvent":
				//rethrow event, otherwise can't cross domain in FF
				var e = $.Event( 'keydown' );
				e.which = event.keyCode;
				this.$el.trigger(e);
				break;
		}
	},

	postMessage: function( message ) {
		if ( "string" === typeof message ){
			try{
				message = JSON.parse( message );
			}
			catch(e){
				return;
			}
		}
		pm({
			target: window.parent,
			type: 'notesIframeMessage',
			data: message
		});
	},

	render: function() {
		var num_new = this.notesList.numberNewNotes();
		var latest_type = this.notesList.at(0).get('type');
		this.postMessage( {action: 'render', num_new: num_new, latest_type: latest_type} );
	},

	togglePanel: function() {
		var t = this;
		if ( this.showingPanel ) {
			this.notesList.loadNoteBodies( function() {
				t.notesListView.reportBodyDelay();
			});
			this.notesList.markNotesSeen();
			this.postMessage( {action: "renderAllSeen"} );
		}
		this.notesListView.reset();
	},

	hidePanel: function() {
		this.postMessage( {action:"togglePanel"}, this.origin );
	}
});

var wptNoteSubjectListView = Backbone.View.extend({
	el: '#wpnt-notes-panel',
	reloadAll: 0, //seconds since reloaded everything (refreshed unread status)
	timeSinceRefresh: 0,
	bodySpinnerShown: false,
	bodyShown: false,
	noteViews: [],

	events: {
	},

	showingPanel: false,
	list_el: null,

	initialize: function() {
		var t = this;
		this.list_el = this.$el.children('#wpnt-notes-list');
		var spinner = $( '<div />', { 
			style: 'position: absolute; top: 100px; left: 200px;'
		} ).spin( 'large' );
		this.list_el.append( spinner );
		this.model.bind('loadNotes:change', this.render, this);
		if ( "object" == typeof wpnt_notes_preloaded && !this.model.length ){
			this.model.addNotes( wpnt_notes_preloaded );
		}
		else {
			this.model.loadNotes( { number: 9, fields: 'id,type,unread,timestamp,subject' } );
		}

		setInterval( function() {
			t.timeSinceRefresh += 30;
			t.reloadAll += 30;
		}, 30000 );

	},

	reportBodyDelay: function(showingEmpty) {
		if ( typeof showingEmpty != "undefined" )
			this.bodyShown = true;
		if ( showingEmpty && this.bodySpinnerShown === false ) {
			this.bodySpinnerShown = (new Date()).getTime();
			return;
		}
		if ( this.bodyShown && this.bodySpinnerShown !== null ) {
			var delay = 0;
			if ( this.bodySpinnerShown )
				var delay = (new Date()).getTime() - this.bodySpinnerShown;
			if ( delay == 0 )
				wpNotesCommon.bumpStat( 'notes_iframe_perceived_bodydelay', '0' );
			else if ( delay < 1000 )
				wpNotesCommon.bumpStat( 'notes_iframe_perceived_bodydelay', '0-1' );
			else if ( delay < 2000 )
				wpNotesCommon.bumpStat( 'notes_iframe_perceived_bodydelay', '1-2' );
			else if ( delay < 4000 )
				wpNotesCommon.bumpStat( 'notes_iframe_perceived_bodydelay', '2-4' );
			else if ( delay < 8000 )
				wpNotesCommon.bumpStat( 'notes_iframe_perceived_bodydelay', '4-8' );
			else
				wpNotesCommon.bumpStat( 'notes_iframe_perceived_bodydelay', '8-N' );
			this.bodySpinnerShown = null;
		}
	},

	refreshNotes: function() {
		if ( ! this.showingPanel && this.model.mostRecentTimestamp && ( 30 <= this.timeSinceRefresh ) ) {
			if ( this.reloadAll > 300 ) {
				this.timeSinceRefresh = 0;
				this.reloadAll = 0;
				this.model.loadNotes( { number: 9, fields: 'id,type,unread,timestamp,subject' } );
			} else {
				this.timeSinceRefresh = 0;
				this.model.loadNotes( { 
					number: 9, 
					since: this.model.mostRecentTimestamp, 
					fields: 'id,type,unread,timestamp,subject' 
				} );
			}
		}
	},

	render: function() {
		this.list_el.empty();
		this.addAllNotes();
	},

	addNote: function( note ) {
		var view = new wpntNoteView( { model: note, noteListView: this } );
		this.list_el.append( view.create().el );
		view.bindNoteBody();
		this.noteViews.push( view );
	},

	addAllNotes: function() {
		var t = this;
		this.noteViews = [];
		this.model.each( function(note) { t.addNote( note ); } );
	},

	reset: function() {
		this.trigger('reset');
	},

	topPosition: function() {
		return this.list_el.position().top - 1;
	},

	bottomPosition: function() {
		return this.list_el.position().top + this.list_el.outerHeight();
	},

	selectNextNote: function() {
		if ( this.noteViews.length == 0 )
			return;
		var idx = this.getActiveNoteIndex();
		if ( idx === false ) {
			idx = 0;
		} else {
			idx += 1;
			if ( idx >= this.noteViews.length )
				idx = 0;
		}
		this.noteViews[idx].clickNoteSummary()
	},

	selectPrevNote: function() {
		if ( this.noteViews.length == 0 )
			return;
		var idx = this.getActiveNoteIndex();
		if ( idx === false ) {
			idx = this.noteViews.length - 1;
		} else {
			idx -= 1;
			if ( idx < 0 )
				idx = this.noteViews.length - 1;
		}
		this.noteViews[idx].clickNoteSummary()
	},

	getActiveNoteIndex: function() {
		for ( var i=0; i < this.noteViews.length; i++ ) {
			if ( false !== this.noteViews[i].showingBody )
				return i;
		}
		return false;
	}

});

var wpntNoteView = Backbone.View.extend({

	container: null,
	noteSubj: null,
	noteBody: null,
	showingBody: false,
	bodyTopPosition: false,
	noteListView: null,

	initialize: function() {
		this.isRtl = $('#wpadminbar').hasClass('rtl');
		this.noteListView = this.options.noteListView;
		this.model.bind('change', this.rerender, this );
		this.model.bind('resize', this.showNoteBody, this );
		this.noteListView.bind('reset', this.close, this );
	},

	create: function() {
		this.setElement( wpNotesCommon.createNoteContainer( this.model.toJSON(), 'wpnt' ) );
		this.noteSubj = this.$el.children('.wpn-note-summary');
		this.noteBody = this.$el.children('.wpn-note-body');
		this.bindNoteSubject();
		if ( this.model.has('body') ) {
			var body = wpNotesCommon.createNoteBody( this.model );
			this.noteBody.replaceWith( body );
			this.noteBody = body;
			if ( this.showingBody )
				this.showNoteBody();
		}
		return this;
	},

	rerender: function() {
		var curr_container = this.$el;
		curr_container.replaceWith( this.create().$el );
		this.bindNoteBody();
		if ( this.showingBody )
			this.showNoteBody();
	},

	close: function() {
		if ( this.showingBody )
			this.hideNoteBody();
	},

	bindNoteSubject: function() {
		var t = this;
		// Click a note to open the note.
		this.noteSubj.unbind( 'click' ).bind( 'click', function(e) {
			e.preventDefault();
			t.clickNoteSummary();
			return false;
		} );

		// Expand note icon on hover
		this.noteSubj.bind({
			mouseenter: function() {
				if ( ! t.noteSubjIcon )
					t.noteSubjIcon = t.noteSubj.children('span.wpn-icon').children('img')[0];
				t.noteSubjIcon.zoomed = false;
				if ( 32 <= t.noteSubjIcon.height && 32 <= t.noteSubjIcon.width )
					return;
				if ( typeof t.noteSubjIcon._width == "undefined" ) {
					t.noteSubjIcon._width = t.noteSubjIcon.width;
					t.noteSubjIcon._height = t.noteSubjIcon.height;
				}
				$(t.noteSubjIcon)
					.stop()
					.animate( { width: 32,
						height: 32 },
						166,
						function(e) {
				  });
				t.noteSubjIcon.zoomed = true;
			},
			mouseleave: function() {
				if ( ! t.noteSubjIcon )
					t.noteSubjIcon = t.noteSubj.children('span.wpn-icon').children('img')[0];
				if ( !t.noteSubjIcon.zoomed )
					return;
				$(t.noteSubjIcon).stop()
					.animate( { width: t.noteSubjIcon._width,
						height: t.noteSubjIcon._height },
						166 );
				t.noteSubjIcon.zoomed = false;
			}
		} );
	},

	bindNoteBody: function() {
		//enable the ajax stuff within the note
		//TODO: fix note muting
		this.noteBody.children('.wpnt-note-mute-icon').click( function(e) {
			e.preventDefault();
			wpNotesAdminBar.toggleNoteMute( $(this) );
			return false;
		} );

		wpFollowButton.enable();
		//this.addTriangle();
		Gravatar.attach_profiles( '#' + this.el.id + ' .wpn-note-body' );
	},

	/*addTriangle: function () {
		// Add a triangle to each note body connecting it visually with its summary
		var triDir = this.isRtl ? 'l' : 'r';
		$('<img class="wpnt-tri" src="//wordpress.com/i/triangle-10x20-'+ triDir + '.png"/>')
			.appendTo( this.noteBody );
	},*/

	clickNoteSummary: function() {
		var show = ! this.showingBody;

		this.noteListView.reset();

		if ( show ) {
			this.showNoteBody();
			var showingEmpty = this.$el.find('.wpn-note-body-empty').length > 0;
			this.noteListView.reportBodyDelay( showingEmpty );
			wpNotesCommon.bumpStat( 'notes-click-type', this.model.get( 'type' ) );
		}
	},

	hideNoteBody: function() {
		if ( this.noteListView.showingPanel )
			this.noteBody.fadeOut(200); //in FF if top div is already hidden, fadeOut won't hide the body
		else
			this.noteBody.hide();
		$( '#wpnt-notes-list .wpn-note.selected' ).removeClass( 'selected' );
		this.showingBody = false;
	},

	showNoteBody: function() {
		var list_top = this.noteListView.topPosition();
		var list_bottom = this.noteListView.bottomPosition();
		this.model.markRead();
		this.$el.removeClass( 'wpn-unread' ).addClass( 'wpn-read' );
		this.showingBody = true;
		var offsetDirection = this.isRtl  ? 'right' : 'left';
		var cssArgs = {};
		cssArgs['z-index'] = -99999;
		cssArgs[offsetDirection] = - this.noteBody.outerWidth() - 6;
		this.noteBody.css(cssArgs);
		$( '#wpnt-notes-list .wpn-note.selected' ).removeClass( 'selected' );
		this.$el.addClass( 'selected' );
		this.bodyTopPosition = this.noteSubj.position().top
			- this.noteBody.outerHeight() / 2
			+ this.noteSubj.outerHeight() / 2;
		var clearance = list_bottom - this.bodyTopPosition - this.noteBody.outerHeight();
		if ( clearance < 0 )
			// Note body ends lower than note list
			this.bodyTopPosition += clearance;
		if ( this.bodyTopPosition < list_top )
			// Note body begins higher than note list
			this.bodyTopPosition = list_top;

		/*$('img.wpnt-tri', this.noteBody)
			.css({top: this.noteSubj.position().top
			      - this.bodyTopPosition + 26}); */
		
		cssArgs['z-index'] = 'auto';
		cssArgs['top'] = this.bodyTopPosition;
		this.noteBody.css(cssArgs);
		this.noteBody.fadeIn(100);

	}
});

$(function(){


//wpNotesAdminBar.init()
wpNotesToolbarClient = new wpntView();
	
});

})(jQuery);
;
