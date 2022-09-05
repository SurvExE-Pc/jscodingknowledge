const SmE = (function(equ){/*
	JavaScript BigInteger library version 0.9
	http://silentmatt.com/biginteger/

	Copyright (c) 2009 Matthew Crumley <email@matthewcrumley.com>
	Copyright (c) 2010,2011 by John Tobey <John.Tobey@gmail.com>
	Licensed under the MIT license.

	Support for arbitrary internal representation base was added by
	Vitaly Magerya.
*/

/*
	File: biginteger.js

	Exports:

		<BigInteger>
*/
var biginteger = {};
(function(exports) {
"use strict";
/*
	Class: BigInteger
	An arbitrarily-large integer.

	<BigInteger> objects should be considered immutable. None of the "built-in"
	methods modify *this* or their arguments. All properties should be
	considered private.

	All the methods of <BigInteger> instances can be called "statically". The
	static versions are convenient if you don't already have a <BigInteger>
	object.

	As an example, these calls are equivalent.

	> BigInteger(4).multiply(5); // returns BigInteger(20);
	> BigInteger.multiply(4, 5); // returns BigInteger(20);

	> var a = 42;
	> var a = BigInteger.toJSValue("0b101010"); // Not completely useless...
*/

var CONSTRUCT = {}; // Unique token to call "private" version of constructor

/*
	Constructor: BigInteger()
	Convert a value to a <BigInteger>.

	Although <BigInteger()> is the constructor for <BigInteger> objects, it is
	best not to call it as a constructor. If *n* is a <BigInteger> object, it is
	simply returned as-is. Otherwise, <BigInteger()> is equivalent to <parse>
	without a radix argument.

	> var n0 = BigInteger();      // Same as <BigInteger.ZERO>
	> var n1 = BigInteger("123"); // Create a new <BigInteger> with value 123
	> var n2 = BigInteger(123);   // Create a new <BigInteger> with value 123
	> var n3 = BigInteger(n2);    // Return n2, unchanged

	The constructor form only takes an array and a sign. *n* must be an
	array of numbers in little-endian order, where each digit is between 0
	and BigInteger.base.  The second parameter sets the sign: -1 for
	negative, +1 for positive, or 0 for zero. The array is *not copied and
	may be modified*. If the array contains only zeros, the sign parameter
	is ignored and is forced to zero.

	> new BigInteger([5], -1): create a new BigInteger with value -5

	Parameters:

		n - Value to convert to a <BigInteger>.

	Returns:

		A <BigInteger> value.

	See Also:

		<parse>, <BigInteger>
*/
function BigInteger(n, s, token) {
	if (token !== CONSTRUCT) {
		if (n instanceof BigInteger) {
			return n;
		}
		else if (typeof n === "undefined") {
			return ZERO;
		}
		return BigInteger.parse(n);
	}

	n = n || [];  // Provide the nullary constructor for subclasses.
	while (n.length && !n[n.length - 1]) {
		--n.length;
	}
	this._d = n;
	this._s = n.length ? (s || 1) : 0;
}

BigInteger._construct = function(n, s) {
	return new BigInteger(n, s, CONSTRUCT);
};

// Base-10 speedup hacks in parse, toString, exp10 and log functions
// require base to be a power of 10. 10^7 is the largest such power
// that won't cause a precision loss when digits are multiplied.
var BigInteger_base = 10000000;
var BigInteger_base_log10 = 7;

BigInteger.base = BigInteger_base;
BigInteger.base_log10 = BigInteger_base_log10;

var ZERO = new BigInteger([], 0, CONSTRUCT);
// Constant: ZERO
// <BigInteger> 0.
BigInteger.ZERO = ZERO;

var ONE = new BigInteger([1], 1, CONSTRUCT);
// Constant: ONE
// <BigInteger> 1.
BigInteger.ONE = ONE;

var M_ONE = new BigInteger(ONE._d, -1, CONSTRUCT);
// Constant: M_ONE
// <BigInteger> -1.
BigInteger.M_ONE = M_ONE;

// Constant: _0
// Shortcut for <ZERO>.
BigInteger._0 = ZERO;

// Constant: _1
// Shortcut for <ONE>.
BigInteger._1 = ONE;

/*
	Constant: small
	Array of <BigIntegers> from 0 to 36.

	These are used internally for parsing, but useful when you need a "small"
	<BigInteger>.

	See Also:

		<ZERO>, <ONE>, <_0>, <_1>
*/
BigInteger.small = [
	ZERO,
	ONE,
	/* Assuming BigInteger_base > 36 */
	new BigInteger( [2], 1, CONSTRUCT),
	new BigInteger( [3], 1, CONSTRUCT),
	new BigInteger( [4], 1, CONSTRUCT),
	new BigInteger( [5], 1, CONSTRUCT),
	new BigInteger( [6], 1, CONSTRUCT),
	new BigInteger( [7], 1, CONSTRUCT),
	new BigInteger( [8], 1, CONSTRUCT),
	new BigInteger( [9], 1, CONSTRUCT),
	new BigInteger([10], 1, CONSTRUCT),
	new BigInteger([11], 1, CONSTRUCT),
	new BigInteger([12], 1, CONSTRUCT),
	new BigInteger([13], 1, CONSTRUCT),
	new BigInteger([14], 1, CONSTRUCT),
	new BigInteger([15], 1, CONSTRUCT),
	new BigInteger([16], 1, CONSTRUCT),
	new BigInteger([17], 1, CONSTRUCT),
	new BigInteger([18], 1, CONSTRUCT),
	new BigInteger([19], 1, CONSTRUCT),
	new BigInteger([20], 1, CONSTRUCT),
	new BigInteger([21], 1, CONSTRUCT),
	new BigInteger([22], 1, CONSTRUCT),
	new BigInteger([23], 1, CONSTRUCT),
	new BigInteger([24], 1, CONSTRUCT),
	new BigInteger([25], 1, CONSTRUCT),
	new BigInteger([26], 1, CONSTRUCT),
	new BigInteger([27], 1, CONSTRUCT),
	new BigInteger([28], 1, CONSTRUCT),
	new BigInteger([29], 1, CONSTRUCT),
	new BigInteger([30], 1, CONSTRUCT),
	new BigInteger([31], 1, CONSTRUCT),
	new BigInteger([32], 1, CONSTRUCT),
	new BigInteger([33], 1, CONSTRUCT),
	new BigInteger([34], 1, CONSTRUCT),
	new BigInteger([35], 1, CONSTRUCT),
	new BigInteger([36], 1, CONSTRUCT)
];

// Used for parsing/radix conversion
BigInteger.digits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/*
	Method: toString
	Convert a <BigInteger> to a string.

	When *base* is greater than 10, letters are upper case.

	Parameters:

		base - Optional base to represent the number in (default is base 10).
		       Must be between 2 and 36 inclusive, or an Error will be thrown.

	Returns:

		The string representation of the <BigInteger>.
*/
BigInteger.prototype.toString = function(base) {
	base = +base || 10;
	if (base < 2 || base > 36) {
		throw new Error("illegal radix " + base + ".");
	}
	if (this._s === 0) {
		return "0";
	}
	if (base === 10) {
		var str = this._s < 0 ? "-" : "";
		str += this._d[this._d.length - 1].toString();
		for (var i = this._d.length - 2; i >= 0; i--) {
			var group = this._d[i].toString();
			while (group.length < BigInteger_base_log10) group = '0' + group;
			str += group;
		}
		return str;
	}
	else {
		var numerals = BigInteger.digits;
		base = BigInteger.small[base];
		var sign = this._s;

		var n = this.abs();
		var digits = [];
		var digit;

		while (n._s !== 0) {
			var divmod = n.divRem(base);
			n = divmod[0];
			digit = divmod[1];
			// TODO: This could be changed to unshift instead of reversing at the end.
			// Benchmark both to compare speeds.
			digits.push(numerals[digit.valueOf()]);
		}
		return (sign < 0 ? "-" : "") + digits.reverse().join("");
	}
};

// Verify strings for parsing
BigInteger.radixRegex = [
	/^$/,
	/^$/,
	/^[01]*$/,
	/^[012]*$/,
	/^[0-3]*$/,
	/^[0-4]*$/,
	/^[0-5]*$/,
	/^[0-6]*$/,
	/^[0-7]*$/,
	/^[0-8]*$/,
	/^[0-9]*$/,
	/^[0-9aA]*$/,
	/^[0-9abAB]*$/,
	/^[0-9abcABC]*$/,
	/^[0-9a-dA-D]*$/,
	/^[0-9a-eA-E]*$/,
	/^[0-9a-fA-F]*$/,
	/^[0-9a-gA-G]*$/,
	/^[0-9a-hA-H]*$/,
	/^[0-9a-iA-I]*$/,
	/^[0-9a-jA-J]*$/,
	/^[0-9a-kA-K]*$/,
	/^[0-9a-lA-L]*$/,
	/^[0-9a-mA-M]*$/,
	/^[0-9a-nA-N]*$/,
	/^[0-9a-oA-O]*$/,
	/^[0-9a-pA-P]*$/,
	/^[0-9a-qA-Q]*$/,
	/^[0-9a-rA-R]*$/,
	/^[0-9a-sA-S]*$/,
	/^[0-9a-tA-T]*$/,
	/^[0-9a-uA-U]*$/,
	/^[0-9a-vA-V]*$/,
	/^[0-9a-wA-W]*$/,
	/^[0-9a-xA-X]*$/,
	/^[0-9a-yA-Y]*$/,
	/^[0-9a-zA-Z]*$/
];

/*
	Function: parse
	Parse a string into a <BigInteger>.

	*base* is optional but, if provided, must be from 2 to 36 inclusive. If
	*base* is not provided, it will be guessed based on the leading characters
	of *s* as follows:

	- "0x" or "0X": *base* = 16
	- "0c" or "0C": *base* = 8
	- "0b" or "0B": *base* = 2
	- else: *base* = 10

	If no base is provided, or *base* is 10, the number can be in exponential
	form. For example, these are all valid:

	> BigInteger.parse("1e9");              // Same as "1000000000"
	> BigInteger.parse("1.234*10^3");       // Same as 1234
	> BigInteger.parse("56789 * 10 ** -2"); // Same as 567

	If any characters fall outside the range defined by the radix, an exception
	will be thrown.

	Parameters:

		s - The string to parse.
		base - Optional radix (default is to guess based on *s*).

	Returns:

		a <BigInteger> instance.
*/
BigInteger.parse = function(s, base) {
	// Expands a number in exponential form to decimal form.
	// expandExponential("-13.441*10^5") === "1344100";
	// expandExponential("1.12300e-1") === "0.112300";
	// expandExponential(1000000000000000000000000000000) === "1000000000000000000000000000000";
	function expandExponential(str) {
		str = str.replace(/\s*[*xX]\s*10\s*(\^|\*\*)\s*/, "e");

		return str.replace(/^([+\-])?(\d+)\.?(\d*)[eE]([+\-]?\d+)$/, function(x, s, n, f, c) {
			c = +c;
			var l = c < 0;
			var i = n.length + c;
			x = (l ? n : f).length;
			c = ((c = Math.abs(c)) >= x ? c - x + l : 0);
			var z = (new Array(c + 1)).join("0");
			var r = n + f;
			return (s || "") + (l ? r = z + r : r += z).substr(0, i += l ? z.length : 0) + (i < r.length ? "." + r.substr(i) : "");
		});
	}

	s = s.toString();
	if (typeof base === "undefined" || +base === 10) {
		s = expandExponential(s);
	}

	var prefixRE;
	if (typeof base === "undefined") {
		prefixRE = '0[xcb]';
	}
	else if (base == 16) {
		prefixRE = '0x';
	}
	else if (base == 8) {
		prefixRE = '0c';
	}
	else if (base == 2) {
		prefixRE = '0b';
	}
	else {
		prefixRE = '';
	}
	var parts = new RegExp('^([+\\-]?)(' + prefixRE + ')?([0-9a-z]*)(?:\\.\\d*)?$', 'i').exec(s);
	if (parts) {
		var sign = parts[1] || "+";
		var baseSection = parts[2] || "";
		var digits = parts[3] || "";

		if (typeof base === "undefined") {
			// Guess base
			if (baseSection === "0x" || baseSection === "0X") { // Hex
				base = 16;
			}
			else if (baseSection === "0c" || baseSection === "0C") { // Octal
				base = 8;
			}
			else if (baseSection === "0b" || baseSection === "0B") { // Binary
				base = 2;
			}
			else {
				base = 10;
			}
		}
		else if (base < 2 || base > 36) {
			throw new Error("Illegal radix " + base + ".");
		}

		base = +base;

		// Check for digits outside the range
		if (!(BigInteger.radixRegex[base].test(digits))) {
			throw new Error("Bad digit for radix " + base);
		}

		// Strip leading zeros, and convert to array
		digits = digits.replace(/^0+/, "").split("");
		if (digits.length === 0) {
			return ZERO;
		}

		// Get the sign (we know it's not zero)
		sign = (sign === "-") ? -1 : 1;

		// Optimize 10
		if (base == 10) {
			var d = [];
			while (digits.length >= BigInteger_base_log10) {
				d.push(parseInt(digits.splice(digits.length-BigInteger.base_log10, BigInteger.base_log10).join(''), 10));
			}
			d.push(parseInt(digits.join(''), 10));
			return new BigInteger(d, sign, CONSTRUCT);
		}

		// Do the conversion
		var d = ZERO;
		base = BigInteger.small[base];
		var small = BigInteger.small;
		for (var i = 0; i < digits.length; i++) {
			d = d.multiply(base).add(small[parseInt(digits[i], 36)]);
		}
		return new BigInteger(d._d, sign, CONSTRUCT);
	}
	else {
		throw new Error("Invalid BigInteger format: " + s);
	}
};

/*
	Function: add
	Add two <BigIntegers>.

	Parameters:

		n - The number to add to *this*. Will be converted to a <BigInteger>.

	Returns:

		The numbers added together.

	See Also:

		<subtract>, <multiply>, <quotient>, <next>
*/
BigInteger.prototype.add = function(n) {
	if (this._s === 0) {
		return BigInteger(n);
	}

	n = BigInteger(n);
	if (n._s === 0) {
		return this;
	}
	if (this._s !== n._s) {
		n = n.negate();
		return this.subtract(n);
	}

	var a = this._d;
	var b = n._d;
	var al = a.length;
	var bl = b.length;
	var sum = new Array(Math.max(al, bl) + 1);
	var size = Math.min(al, bl);
	var carry = 0;
	var digit;

	for (var i = 0; i < size; i++) {
		digit = a[i] + b[i] + carry;
		sum[i] = digit % BigInteger_base;
		carry = (digit / BigInteger_base) | 0;
	}
	if (bl > al) {
		a = b;
		al = bl;
	}
	for (i = size; carry && i < al; i++) {
		digit = a[i] + carry;
		sum[i] = digit % BigInteger_base;
		carry = (digit / BigInteger_base) | 0;
	}
	if (carry) {
		sum[i] = carry;
	}

	for ( ; i < al; i++) {
		sum[i] = a[i];
	}

	return new BigInteger(sum, this._s, CONSTRUCT);
};

/*
	Function: negate
	Get the additive inverse of a <BigInteger>.

	Returns:

		A <BigInteger> with the same magnatude, but with the opposite sign.

	See Also:

		<abs>
*/
BigInteger.prototype.negate = function() {
	return new BigInteger(this._d, (-this._s) | 0, CONSTRUCT);
};

/*
	Function: abs
	Get the absolute value of a <BigInteger>.

	Returns:

		A <BigInteger> with the same magnatude, but always positive (or zero).

	See Also:

		<negate>
*/
BigInteger.prototype.abs = function() {
	return (this._s < 0) ? this.negate() : this;
};

/*
	Function: subtract
	Subtract two <BigIntegers>.

	Parameters:

		n - The number to subtract from *this*. Will be converted to a <BigInteger>.

	Returns:

		The *n* subtracted from *this*.

	See Also:

		<add>, <multiply>, <quotient>, <prev>
*/
BigInteger.prototype.subtract = function(n) {
	if (this._s === 0) {
		return BigInteger(n).negate();
	}

	n = BigInteger(n);
	if (n._s === 0) {
		return this;
	}
	if (this._s !== n._s) {
		n = n.negate();
		return this.add(n);
	}

	var m = this;
	// negative - negative => -|a| - -|b| => -|a| + |b| => |b| - |a|
	if (this._s < 0) {
		m = new BigInteger(n._d, 1, CONSTRUCT);
		n = new BigInteger(this._d, 1, CONSTRUCT);
	}

	// Both are positive => a - b
	var sign = m.compareAbs(n);
	if (sign === 0) {
		return ZERO;
	}
	else if (sign < 0) {
		// swap m and n
		var t = n;
		n = m;
		m = t;
	}

	// a > b
	var a = m._d;
	var b = n._d;
	var al = a.length;
	var bl = b.length;
	var diff = new Array(al); // al >= bl since a > b
	var borrow = 0;
	var i;
	var digit;

	for (i = 0; i < bl; i++) {
		digit = a[i] - borrow - b[i];
		if (digit < 0) {
			digit += BigInteger_base;
			borrow = 1;
		}
		else {
			borrow = 0;
		}
		diff[i] = digit;
	}
	for (i = bl; i < al; i++) {
		digit = a[i] - borrow;
		if (digit < 0) {
			digit += BigInteger_base;
		}
		else {
			diff[i++] = digit;
			break;
		}
		diff[i] = digit;
	}
	for ( ; i < al; i++) {
		diff[i] = a[i];
	}

	return new BigInteger(diff, sign, CONSTRUCT);
};

(function() {
	function addOne(n, sign) {
		var a = n._d;
		var sum = a.slice();
		var carry = true;
		var i = 0;

		while (true) {
			var digit = (a[i] || 0) + 1;
			sum[i] = digit % BigInteger_base;
			if (digit <= BigInteger_base - 1) {
				break;
			}
			++i;
		}

		return new BigInteger(sum, sign, CONSTRUCT);
	}

	function subtractOne(n, sign) {
		var a = n._d;
		var sum = a.slice();
		var borrow = true;
		var i = 0;

		while (true) {
			var digit = (a[i] || 0) - 1;
			if (digit < 0) {
				sum[i] = digit + BigInteger_base;
			}
			else {
				sum[i] = digit;
				break;
			}
			++i;
		}

		return new BigInteger(sum, sign, CONSTRUCT);
	}

	/*
		Function: next
		Get the next <BigInteger> (add one).

		Returns:

			*this* + 1.

		See Also:

			<add>, <prev>
	*/
	BigInteger.prototype.next = function() {
		switch (this._s) {
		case 0:
			return ONE;
		case -1:
			return subtractOne(this, -1);
		// case 1:
		default:
			return addOne(this, 1);
		}
	};

	/*
		Function: prev
		Get the previous <BigInteger> (subtract one).

		Returns:

			*this* - 1.

		See Also:

			<next>, <subtract>
	*/
	BigInteger.prototype.prev = function() {
		switch (this._s) {
		case 0:
			return M_ONE;
		case -1:
			return addOne(this, -1);
		// case 1:
		default:
			return subtractOne(this, 1);
		}
	};
})();

/*
	Function: compareAbs
	Compare the absolute value of two <BigIntegers>.

	Calling <compareAbs> is faster than calling <abs> twice, then <compare>.

	Parameters:

		n - The number to compare to *this*. Will be converted to a <BigInteger>.

	Returns:

		-1, 0, or +1 if *|this|* is less than, equal to, or greater than *|n|*.

	See Also:

		<compare>, <abs>
*/
BigInteger.prototype.compareAbs = function(n) {
	if (this === n) {
		return 0;
	}

	if (!(n instanceof BigInteger)) {
		if (!isFinite(n)) {
			return(isNaN(n) ? n : -1);
		}
		n = BigInteger(n);
	}

	if (this._s === 0) {
		return (n._s !== 0) ? -1 : 0;
	}
	if (n._s === 0) {
		return 1;
	}

	var l = this._d.length;
	var nl = n._d.length;
	if (l < nl) {
		return -1;
	}
	else if (l > nl) {
		return 1;
	}

	var a = this._d;
	var b = n._d;
	for (var i = l-1; i >= 0; i--) {
		if (a[i] !== b[i]) {
			return a[i] < b[i] ? -1 : 1;
		}
	}

	return 0;
};

/*
	Function: compare
	Compare two <BigIntegers>.

	Parameters:

		n - The number to compare to *this*. Will be converted to a <BigInteger>.

	Returns:

		-1, 0, or +1 if *this* is less than, equal to, or greater than *n*.

	See Also:

		<compareAbs>, <isPositive>, <isNegative>, <isUnit>
*/
BigInteger.prototype.compare = function(n) {
	if (this === n) {
		return 0;
	}

	n = BigInteger(n);

	if (this._s === 0) {
		return -n._s;
	}

	if (this._s === n._s) { // both positive or both negative
		var cmp = this.compareAbs(n);
		return cmp * this._s;
	}
	else {
		return this._s;
	}
};

/*
	Function: isUnit
	Return true iff *this* is either 1 or -1.

	Returns:

		true if *this* compares equal to <BigInteger.ONE> or <BigInteger.M_ONE>.

	See Also:

		<isZero>, <isNegative>, <isPositive>, <compareAbs>, <compare>,
		<BigInteger.ONE>, <BigInteger.M_ONE>
*/
BigInteger.prototype.isUnit = function() {
	return this === ONE ||
		this === M_ONE ||
		(this._d.length === 1 && this._d[0] === 1);
};

/*
	Function: multiply
	Multiply two <BigIntegers>.

	Parameters:

		n - The number to multiply *this* by. Will be converted to a
		<BigInteger>.

	Returns:

		The numbers multiplied together.

	See Also:

		<add>, <subtract>, <quotient>, <square>
*/
BigInteger.prototype.multiply = function(n) {
	// TODO: Consider adding Karatsuba multiplication for large numbers
	if (this._s === 0) {
		return ZERO;
	}

	n = BigInteger(n);
	if (n._s === 0) {
		return ZERO;
	}
	if (this.isUnit()) {
		if (this._s < 0) {
			return n.negate();
		}
		return n;
	}
	if (n.isUnit()) {
		if (n._s < 0) {
			return this.negate();
		}
		return this;
	}
	if (this === n) {
		return this.square();
	}

	var r = (this._d.length >= n._d.length);
	var a = (r ? this : n)._d; // a will be longer than b
	var b = (r ? n : this)._d;
	var al = a.length;
	var bl = b.length;

	var pl = al + bl;
	var partial = new Array(pl);
	var i;
	for (i = 0; i < pl; i++) {
		partial[i] = 0;
	}

	for (i = 0; i < bl; i++) {
		var carry = 0;
		var bi = b[i];
		var jlimit = al + i;
		var digit;
		for (var j = i; j < jlimit; j++) {
			digit = partial[j] + bi * a[j - i] + carry;
			carry = (digit / BigInteger_base) | 0;
			partial[j] = (digit % BigInteger_base) | 0;
		}
		if (carry) {
			digit = partial[j] + carry;
			carry = (digit / BigInteger_base) | 0;
			partial[j] = digit % BigInteger_base;
		}
	}
	return new BigInteger(partial, this._s * n._s, CONSTRUCT);
};

// Multiply a BigInteger by a single-digit native number
// Assumes that this and n are >= 0
// This is not really intended to be used outside the library itself
BigInteger.prototype.multiplySingleDigit = function(n) {
	if (n === 0 || this._s === 0) {
		return ZERO;
	}
	if (n === 1) {
		return this;
	}

	var digit;
	if (this._d.length === 1) {
		digit = this._d[0] * n;
		if (digit >= BigInteger_base) {
			return new BigInteger([(digit % BigInteger_base)|0,
					(digit / BigInteger_base)|0], 1, CONSTRUCT);
		}
		return new BigInteger([digit], 1, CONSTRUCT);
	}

	if (n === 2) {
		return this.add(this);
	}
	if (this.isUnit()) {
		return new BigInteger([n], 1, CONSTRUCT);
	}

	var a = this._d;
	var al = a.length;

	var pl = al + 1;
	var partial = new Array(pl);
	for (var i = 0; i < pl; i++) {
		partial[i] = 0;
	}

	var carry = 0;
	for (var j = 0; j < al; j++) {
		digit = n * a[j] + carry;
		carry = (digit / BigInteger_base) | 0;
		partial[j] = (digit % BigInteger_base) | 0;
	}
	if (carry) {
		partial[j] = carry;
	}

	return new BigInteger(partial, 1, CONSTRUCT);
};

/*
	Function: square
	Multiply a <BigInteger> by itself.

	This is slightly faster than regular multiplication, since it removes the
	duplicated multiplcations.

	Returns:

		> this.multiply(this)

	See Also:
		<multiply>
*/
BigInteger.prototype.square = function() {
	// Normally, squaring a 10-digit number would take 100 multiplications.
	// Of these 10 are unique diagonals, of the remaining 90 (100-10), 45 are repeated.
	// This procedure saves (N*(N-1))/2 multiplications, (e.g., 45 of 100 multiplies).
	// Based on code by Gary Darby, Intellitech Systems Inc., www.DelphiForFun.org

	if (this._s === 0) {
		return ZERO;
	}
	if (this.isUnit()) {
		return ONE;
	}

	var digits = this._d;
	var length = digits.length;
	var imult1 = new Array(length + length + 1);
	var product, carry, k;
	var i;

	// Calculate diagonal
	for (i = 0; i < length; i++) {
		k = i * 2;
		product = digits[i] * digits[i];
		carry = (product / BigInteger_base) | 0;
		imult1[k] = product % BigInteger_base;
		imult1[k + 1] = carry;
	}

	// Calculate repeating part
	for (i = 0; i < length; i++) {
		carry = 0;
		k = i * 2 + 1;
		for (var j = i + 1; j < length; j++, k++) {
			product = digits[j] * digits[i] * 2 + imult1[k] + carry;
			carry = (product / BigInteger_base) | 0;
			imult1[k] = product % BigInteger_base;
		}
		k = length + i;
		var digit = carry + imult1[k];
		carry = (digit / BigInteger_base) | 0;
		imult1[k] = digit % BigInteger_base;
		imult1[k + 1] += carry;
	}

	return new BigInteger(imult1, 1, CONSTRUCT);
};

/*
	Function: quotient
	Divide two <BigIntegers> and truncate towards zero.

	<quotient> throws an exception if *n* is zero.

	Parameters:

		n - The number to divide *this* by. Will be converted to a <BigInteger>.

	Returns:

		The *this* / *n*, truncated to an integer.

	See Also:

		<add>, <subtract>, <multiply>, <divRem>, <remainder>
*/
BigInteger.prototype.quotient = function(n) {
	return this.divRem(n)[0];
};

/*
	Function: divide
	Deprecated synonym for <quotient>.
*/
BigInteger.prototype.divide = BigInteger.prototype.quotient;

/*
	Function: remainder
	Calculate the remainder of two <BigIntegers>.

	<remainder> throws an exception if *n* is zero.

	Parameters:

		n - The remainder after *this* is divided *this* by *n*. Will be
		    converted to a <BigInteger>.

	Returns:

		*this* % *n*.

	See Also:

		<divRem>, <quotient>
*/
BigInteger.prototype.remainder = function(n) {
	return this.divRem(n)[1];
};

/*
	Function: divRem
	Calculate the integer quotient and remainder of two <BigIntegers>.

	<divRem> throws an exception if *n* is zero.

	Parameters:

		n - The number to divide *this* by. Will be converted to a <BigInteger>.

	Returns:

		A two-element array containing the quotient and the remainder.

		> a.divRem(b)

		is exactly equivalent to

		> [a.quotient(b), a.remainder(b)]

		except it is faster, because they are calculated at the same time.

	See Also:

		<quotient>, <remainder>
*/
BigInteger.prototype.divRem = function(n) {
	n = BigInteger(n);
	if (n._s === 0) {
		throw new Error("Divide by zero");
	}
	if (this._s === 0) {
		return [ZERO, ZERO];
	}
	if (n._d.length === 1) {
		return this.divRemSmall(n._s * n._d[0]);
	}

	// Test for easy cases -- |n1| <= |n2|
	switch (this.compareAbs(n)) {
	case 0: // n1 == n2
		return [this._s === n._s ? ONE : M_ONE, ZERO];
	case -1: // |n1| < |n2|
		return [ZERO, this];
	}

	var sign = this._s * n._s;
	var a = n.abs();
	var b_digits = this._d;
	var b_index = b_digits.length;
	var digits = n._d.length;
	var quot = [];
	var guess;

	var part = new BigInteger([], 0, CONSTRUCT);
	part._s = 1;

	while (b_index) {
		part._d.unshift(b_digits[--b_index]);

		if (part.compareAbs(n) < 0) {
			quot.push(0);
			continue;
		}
		if (part._s === 0) {
			guess = 0;
		}
		else {
			var xlen = part._d.length, ylen = a._d.length;
			var highx = part._d[xlen-1]*BigInteger_base + part._d[xlen-2];
			var highy = a._d[ylen-1]*BigInteger_base + a._d[ylen-2];
			if (part._d.length > a._d.length) {
				// The length of part._d can either match a._d length,
				// or exceed it by one.
				highx = (highx+1)*BigInteger_base;
			}
			guess = Math.ceil(highx/highy);
		}
		do {
			var check = a.multiplySingleDigit(guess);
			if (check.compareAbs(part) <= 0) {
				break;
			}
			guess--;
		} while (guess);

		quot.push(guess);
		if (!guess) {
			continue;
		}
		var diff = part.subtract(check);
		part._d = diff._d.slice();
		if (part._d.length === 0) {
			part._s = 0;
		}
	}

	return [new BigInteger(quot.reverse(), sign, CONSTRUCT),
		   new BigInteger(part._d, this._s, CONSTRUCT)];
};

// Throws an exception if n is outside of (-BigInteger.base, -1] or
// [1, BigInteger.base).  It's not necessary to call this, since the
// other division functions will call it if they are able to.
BigInteger.prototype.divRemSmall = function(n) {
	var r;
	n = +n;
	if (n === 0) {
		throw new Error("Divide by zero");
	}

	var n_s = n < 0 ? -1 : 1;
	var sign = this._s * n_s;
	n = Math.abs(n);

	if (n < 1 || n >= BigInteger_base) {
		throw new Error("Argument out of range");
	}

	if (this._s === 0) {
		return [ZERO, ZERO];
	}

	if (n === 1 || n === -1) {
		return [(sign === 1) ? this.abs() : new BigInteger(this._d, sign, CONSTRUCT), ZERO];
	}

	// 2 <= n < BigInteger_base

	// divide a single digit by a single digit
	if (this._d.length === 1) {
		var q = new BigInteger([(this._d[0] / n) | 0], 1, CONSTRUCT);
		r = new BigInteger([(this._d[0] % n) | 0], 1, CONSTRUCT);
		if (sign < 0) {
			q = q.negate();
		}
		if (this._s < 0) {
			r = r.negate();
		}
		return [q, r];
	}

	var digits = this._d.slice();
	var quot = new Array(digits.length);
	var part = 0;
	var diff = 0;
	var i = 0;
	var guess;

	while (digits.length) {
		part = part * BigInteger_base + digits[digits.length - 1];
		if (part < n) {
			quot[i++] = 0;
			digits.pop();
			diff = BigInteger_base * diff + part;
			continue;
		}
		if (part === 0) {
			guess = 0;
		}
		else {
			guess = (part / n) | 0;
		}

		var check = n * guess;
		diff = part - check;
		quot[i++] = guess;
		if (!guess) {
			digits.pop();
			continue;
		}

		digits.pop();
		part = diff;
	}

	r = new BigInteger([diff], 1, CONSTRUCT);
	if (this._s < 0) {
		r = r.negate();
	}
	return [new BigInteger(quot.reverse(), sign, CONSTRUCT), r];
};

/*
	Function: isEven
	Return true iff *this* is divisible by two.

	Note that <BigInteger.ZERO> is even.

	Returns:

		true if *this* is even, false otherwise.

	See Also:

		<isOdd>
*/
BigInteger.prototype.isEven = function() {
	var digits = this._d;
	return this._s === 0 || digits.length === 0 || (digits[0] % 2) === 0;
};

/*
	Function: isOdd
	Return true iff *this* is not divisible by two.

	Returns:

		true if *this* is odd, false otherwise.

	See Also:

		<isEven>
*/
BigInteger.prototype.isOdd = function() {
	return !this.isEven();
};

/*
	Function: sign
	Get the sign of a <BigInteger>.

	Returns:

		* -1 if *this* < 0
		* 0 if *this* == 0
		* +1 if *this* > 0

	See Also:

		<isZero>, <isPositive>, <isNegative>, <compare>, <BigInteger.ZERO>
*/
BigInteger.prototype.sign = function() {
	return this._s;
};

/*
	Function: isPositive
	Return true iff *this* > 0.

	Returns:

		true if *this*.compare(<BigInteger.ZERO>) == 1.

	See Also:

		<sign>, <isZero>, <isNegative>, <isUnit>, <compare>, <BigInteger.ZERO>
*/
BigInteger.prototype.isPositive = function() {
	return this._s > 0;
};

/*
	Function: isNegative
	Return true iff *this* < 0.

	Returns:

		true if *this*.compare(<BigInteger.ZERO>) == -1.

	See Also:

		<sign>, <isPositive>, <isZero>, <isUnit>, <compare>, <BigInteger.ZERO>
*/
BigInteger.prototype.isNegative = function() {
	return this._s < 0;
};

/*
	Function: isZero
	Return true iff *this* == 0.

	Returns:

		true if *this*.compare(<BigInteger.ZERO>) == 0.

	See Also:

		<sign>, <isPositive>, <isNegative>, <isUnit>, <BigInteger.ZERO>
*/
BigInteger.prototype.isZero = function() {
	return this._s === 0;
};

/*
	Function: exp10
	Multiply a <BigInteger> by a power of 10.

	This is equivalent to, but faster than

	> if (n >= 0) {
	>     return this.multiply(BigInteger("1e" + n));
	> }
	> else { // n <= 0
	>     return this.quotient(BigInteger("1e" + -n));
	> }

	Parameters:

		n - The power of 10 to multiply *this* by. *n* is converted to a
		javascipt number and must be no greater than <BigInteger.MAX_EXP>
		(0x7FFFFFFF), or an exception will be thrown.

	Returns:

		*this* * (10 ** *n*), truncated to an integer if necessary.

	See Also:

		<pow>, <multiply>
*/
BigInteger.prototype.exp10 = function(n) {
	n = +n;
	if (n === 0) {
		return this;
	}
	if (Math.abs(n) > Number(MAX_EXP)) {
		throw new Error("exponent too large in BigInteger.exp10");
	}
	if (n > 0) {
		var k = new BigInteger(this._d.slice(), this._s, CONSTRUCT);

		for (; n >= BigInteger_base_log10; n -= BigInteger_base_log10) {
			k._d.unshift(0);
		}
		if (n == 0)
			return k;
		k._s = 1;
		k = k.multiplySingleDigit(Math.pow(10, n));
		return (this._s < 0 ? k.negate() : k);
	} else if (-n >= this._d.length*BigInteger_base_log10) {
		return ZERO;
	} else {
		var k = new BigInteger(this._d.slice(), this._s, CONSTRUCT);

		for (n = -n; n >= BigInteger_base_log10; n -= BigInteger_base_log10) {
			k._d.shift();
		}
		return (n == 0) ? k : k.divRemSmall(Math.pow(10, n))[0];
	}
};

/*
	Function: pow
	Raise a <BigInteger> to a power.

	In this implementation, 0**0 is 1.

	Parameters:

		n - The exponent to raise *this* by. *n* must be no greater than
		<BigInteger.MAX_EXP> (0x7FFFFFFF), or an exception will be thrown.

	Returns:

		*this* raised to the *nth* power.

	See Also:

		<modPow>
*/
BigInteger.prototype.pow = function(n) {
	if (this.isUnit()) {
		if (this._s > 0) {
			return this;
		}
		else {
			return BigInteger(n).isOdd() ? this : this.negate();
		}
	}

	n = BigInteger(n);
	if (n._s === 0) {
		return ONE;
	}
	else if (n._s < 0) {
		if (this._s === 0) {
			throw new Error("Divide by zero");
		}
		else {
			return ZERO;
		}
	}
	if (this._s === 0) {
		return ZERO;
	}
	if (n.isUnit()) {
		return this;
	}

	if (n.compareAbs(MAX_EXP) > 0) {
		throw new Error("exponent too large in BigInteger.pow");
	}
	var x = this;
	var aux = ONE;
	var two = BigInteger.small[2];

	while (n.isPositive()) {
		if (n.isOdd()) {
			aux = aux.multiply(x);
			if (n.isUnit()) {
				return aux;
			}
		}
		x = x.square();
		n = n.quotient(two);
	}

	return aux;
};

/*
	Function: modPow
	Raise a <BigInteger> to a power (mod m).

	Because it is reduced by a modulus, <modPow> is not limited by
	<BigInteger.MAX_EXP> like <pow>.

	Parameters:

		exponent - The exponent to raise *this* by. Must be positive.
		modulus - The modulus.

	Returns:

		*this* ^ *exponent* (mod *modulus*).

	See Also:

		<pow>, <mod>
*/
BigInteger.prototype.modPow = function(exponent, modulus) {
	var result = ONE;
	var base = this;

	while (exponent.isPositive()) {
		if (exponent.isOdd()) {
			result = result.multiply(base).remainder(modulus);
		}

		exponent = exponent.quotient(BigInteger.small[2]);
		if (exponent.isPositive()) {
			base = base.square().remainder(modulus);
		}
	}

	return result;
};

/*
	Function: log
	Get the natural logarithm of a <BigInteger> as a native JavaScript number.

	This is equivalent to

	> Math.log(this.toJSValue())

	but handles values outside of the native number range.

	Returns:

		log( *this* )

	See Also:

		<toJSValue>
*/
BigInteger.prototype.log = function() {
	switch (this._s) {
	case 0:	 return -Infinity;
	case -1: return NaN;
	default: // Fall through.
	}

	var l = this._d.length;

	if (l*BigInteger_base_log10 < 30) {
		return Math.log(this.valueOf());
	}

	var N = Math.ceil(30/BigInteger_base_log10);
	var firstNdigits = this._d.slice(l - N);
	return Math.log((new BigInteger(firstNdigits, 1, CONSTRUCT)).valueOf()) + (l - N) * Math.log(BigInteger_base);
};

/*
	Function: valueOf
	Convert a <BigInteger> to a native JavaScript integer.

	This is called automatically by JavaScipt to convert a <BigInteger> to a
	native value.

	Returns:

		> parseInt(this.toString(), 10)

	See Also:

		<toString>, <toJSValue>
*/
BigInteger.prototype.valueOf = function() {
	return parseInt(this.toString(), 10);
};

/*
	Function: toJSValue
	Convert a <BigInteger> to a native JavaScript integer.

	This is the same as valueOf, but more explicitly named.

	Returns:

		> parseInt(this.toString(), 10)

	See Also:

		<toString>, <valueOf>
*/
BigInteger.prototype.toJSValue = function() {
	return parseInt(this.toString(), 10);
};

var MAX_EXP = BigInteger(0x7FFFFFFF);
// Constant: MAX_EXP
// The largest exponent allowed in <pow> and <exp10> (0x7FFFFFFF or 2147483647).
BigInteger.MAX_EXP = MAX_EXP;

(function() {
	function makeUnary(fn) {
		return function(a) {
			return fn.call(BigInteger(a));
		};
	}

	function makeBinary(fn) {
		return function(a, b) {
			return fn.call(BigInteger(a), BigInteger(b));
		};
	}

	function makeTrinary(fn) {
		return function(a, b, c) {
			return fn.call(BigInteger(a), BigInteger(b), BigInteger(c));
		};
	}

	(function() {
		var i, fn;
		var unary = "toJSValue,isEven,isOdd,sign,isZero,isNegative,abs,isUnit,square,negate,isPositive,toString,next,prev,log".split(",");
		var binary = "compare,remainder,divRem,subtract,add,quotient,divide,multiply,pow,compareAbs".split(",");
		var trinary = ["modPow"];

		for (i = 0; i < unary.length; i++) {
			fn = unary[i];
			BigInteger[fn] = makeUnary(BigInteger.prototype[fn]);
		}

		for (i = 0; i < binary.length; i++) {
			fn = binary[i];
			BigInteger[fn] = makeBinary(BigInteger.prototype[fn]);
		}

		for (i = 0; i < trinary.length; i++) {
			fn = trinary[i];
			BigInteger[fn] = makeTrinary(BigInteger.prototype[fn]);
		}

		BigInteger.exp10 = function(x, n) {
			return BigInteger(x).exp10(n);
		};
	})();
})();

exports.BigInteger = BigInteger;
})(biginteger);

var assert = function () { return assert.ok.apply(this, arguments); };
(function (exports) {
  "use strict";

// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

var pSlice = Array.prototype.slice;

// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = exports;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.message = options.message;
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  var stackStartFunction = options.stackStartFunction || fail;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  }
};
assert.AssertionError.prototype = Object.create(Error.prototype);

assert.AssertionError.prototype.toString = function() {
  if (this.message) {
    return [this.name + ':', this.message].join(' ');
  } else {
    return [this.name + ':',
            JSON.stringify(this.expected),
            this.operator,
            JSON.stringify(this.actual)].join(' ');
  }
};

// assert.AssertionError instanceof Error

assert.AssertionError.__proto__ = Error.prototype;

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

assert.ok = function ok(value, message) {
  if (!!!value) fail(value, true, message, '==', assert.ok);
};

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

function _deepEqual(actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (typeof actual != 'object' && typeof expected != 'object') {
    return actual == expected;

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
}

function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b) {
  if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b);
  }
  try {
    var ka = Object.keys(a),
        kb = Object.keys(b),
        key, i;
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (expected instanceof RegExp) {
    return expected.test(actual);
  } else if (actual instanceof expected) {
    return true;
  } else if (expected.call({}, actual) === true) {
    return true;
  }

  return false;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (typeof expected === 'string') {
    message = expected;
    expected = null;
  }

  try {
    block();
  } catch (e) {
    actual = e;
  }

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail('Missing expected exception' + message);
  }

  if (!shouldThrow && expectedException(actual, expected)) {
    fail('Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [true].concat(pSlice.call(arguments)));
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [false].concat(pSlice.call(arguments)));
};

assert.ifError = function(err) { if (err) {throw err;}};

}(assert));

const math = {
    add: function (a,b) {
        return a+b;
    },
    min : function (a,b) {
        return a-b;
    },
    mul : function (a,b) {
        return a*b;
    },
    div : function (a,b) {
        return a/b;
    },
    pwr : function (a,b) {
        return a^b;
    },
    pct : function (a,b) {
        return a%b;
    },
    sin : function (a,t) {
        if (sin==0) {
            return Math.sin(a);
        } else {
            return Math.asin(a);
        };
    },
    tan : function (a,t) {
        if (sin==0) {
            return Math.tan(a);
        } else {
            return Math.atan(a);
        };
    },
    cos : function (a,t) {
        if (sin==0) {
            return Math.cos(a);
        } else {
            return Math.acos(a);
        };
    }
};
// # calculator-parser.js
//
// a simple calculator language

// This program parses a very simple language that just does a little basic
// arithmetic. Here are some simple examples of the sort of thing you can
// write in the calculator language:
//
//   * `2 + 2`
//   * `1 * 2 + 3 * 4 + 5 / 6`
//   * `3 + 1/(7 + 1/(15 + 1/(1 + 1/(292 + 1/(1 + 1/(1 + 1/1))))))`
//   * `1 / ((z + 1) * (z - 1))`
//
// If you’d like to try it out, open [calculator.html](../calculator.html).


// ## Part One – Breaking code down into tokens

// This function, `tokenize(code)`, takes a string `code` and splits it into
// *tokens*, the numbers, words, and symbols that make up our little calculator
// mini-language.
function tokenize(code) {
    var results = [];
    var tokenRegExp = /\s*([A-Za-z]+|[0-9]+|\S)\s*/g;

    var m;
    while ((m = tokenRegExp.exec(code)) !== null)
        results.push(m[1]);
    return results;
}

// Let’s test as we go!
assert.deepEqual(tokenize("123\n"), ["123"]);
assert.deepEqual(tokenize("2+2"), ["2", "+", "2"]);
assert.deepEqual(tokenize("+-*/"), ["+", "-", "*", "/"]);
assert.deepEqual(tokenize("   1   * 24 +\n\n  pi"), ["1", "*", "24", "+", "pi"]);
assert.deepEqual(tokenize("()"), ["(", ")"]);
assert.deepEqual(tokenize("    "), []);



// Here are a few helper functions for working with tokens. To keep things
// simple, a number is any sequence of digits.
function isNumber(token) {
    return token !== undefined && token.match(/^[0-9]+$/) !== null;
}

// And a *name*, or identifier, is any sequence of letters.
function isName(token) {
    return token !== undefined && token.match(/^[A-Za-z]+$/) !== null;
}

// Tests.
assert(isNumber("123"));
assert(!isNumber("x"));
assert(!isNumber("-"));
assert(isName("xyz"));
assert(!isName("+"));


// ## Part Two – The parser

// The parser’s job is to decode the input and build a collection of objects
// that represent the code.
//
// (This is just like the way a Web browser decodes an HTML file and builds the
// DOM. The part that does that is called the HTML parser.)

// Parse the given string `code` as an expression in our little language.
//
function parse(code) {
    // Break the input into tokens.
    var tokens = tokenize(code);

    // The parser will do a single left-to-right pass over `tokens`, with no
    // backtracking. `position` is the index of the next token. Start at
    // 0. We’ll increment this as we go.
    var position = 0;

    // `peek()` returns the next token without advancing `position`.
    function peek() {
        return tokens[position];
    }

    // `consume(token)` consumes one token, moving `position` to point to the next one.
    function consume(token) {
        assert.strictEqual(token, tokens[position]);
        position++;
    }

    // Now we have the functions that are actually responsible for parsing.
    // This is the cool part. Each group of syntax rules is translated to one
    // function.

    // Parse a *PrimaryExpr*—that is, tokens matching one of the three syntax
    // rules below. Whatever kind of expression we find, we return the corresponding
    // JS object.
    //
    // <div style="margin-left: 2em">
    //  <div>*PrimaryExpr* **:**</div>
    //  <div style="margin-left: 2em">
    //   <div>*Number*</div>
    //   <div>*Name*</div>
    //   <div><b><code>(</code></b> *Expr* <b><code>)</code></b></div>
    //  </div>
    // </div>
    function parsePrimaryExpr() {
        var t = peek();

        if (isNumber(t)) {
            consume(t);
            return {type: "number", value: t};
        } else if (isName(t)) {
            consume(t);
            return {type: "name", id: t};
        } else if (t === "(") {
            consume(t);
            var expr = parseExpr();
            if (peek() !== ")")
                throw new SyntaxError("expected )");
            consume(")");
            return expr;
        } else {
            // If we get here, the next token doesn’t match any of the three
            // rules. So it’s an error.
            throw new SyntaxError("expected a number, a variable, or parentheses");
        }
    }

    // <div style="margin-left: 2em; margin-bottom: 1em">
    //  *MulExpr* **:**
    //  <div style="margin-left: 2em">
    //   <div>*PrimaryExpr* ( <b><code>\*</code></b> *PrimaryExpr* | <b><code>/</code></b> *PrimaryExpr* )<sup>\*</sup></div>
    //  </div>
    // </div>
    function parseMulExpr() {
        var expr = parsePrimaryExpr();
        var t = peek();
        while (t === "*" || t === "/") {
            consume(t);
            var rhs = parsePrimaryExpr();
            expr = {type: t, left: expr, right: rhs};
            t = peek();
        }
        return expr;
    }

    // <div style="margin-left: 2em">
    //  *Expr* **:**
    //  <div style="margin-left: 2em">
    //   <div>*MulExpr* ( <b><code>+</code></b> *MulExpr* | <b><code>-</code></b> *MulExpr* )<sup>\*</sup></div>
    //  </div>
    // </div>
    function parseExpr() {
        var expr = parseMulExpr();
        var t = peek();
        while (t === "+" || t === "-") {
            consume(t);
            var rhs = parseMulExpr();
            expr = {type: t, left: expr, right: rhs};
            t = peek();
        }
        return expr;
    }

    // Now all that remains, really, is to call `parseExpr()` to parse an *Expr*.
    var result = parseExpr();

    // Well, one more thing. Make sure `parseExpr()` consumed *all* the
    // input. If it didn’t, that means the next token didn’t match any syntax
    // rule, which is an error.
    if (position !== tokens.length)
        throw new SyntaxError("unexpected '" + peek() + "'");

    return result;
}
// # calculator-backends.js
//
// things to do with a simple calculator parser
//
// [calculator-parser.js](calculator-parser.html) contains a simple parser.
// It contains enough code that you can actually do some basic math with it.
// But what else can you do with a parser?
//
// This file contains seven different applications of
// the calculator parser.
//
// [Try them out.](../calculator.html)

// ## Code as data

// ### 1. Show the JSON
//
// Unmodified, the parser simply builds a tree describing the input
// formula. This is called an abstract syntax tree, or AST.
//
function convertToJSON(code) {
    return parse(code);
}


// ### 2. Convert to DOM
//
// Of course one of the nice things about JSON is that there are many ways to
// display it. Here’s code that spits out DOM nodes that show how the program
// would look in Scratch. (!)

// Helper function to create DOM elements.
function span(className, contents) {
    var e = document.createElement("span");
    e.className = className;
    for (var i = 0; i < contents.length; i++) {
        var kid = contents[i];
        if (typeof kid === "string")
            kid = document.createTextNode(kid);
        e.appendChild(kid);
    }
    return e;
}

function convertToDOM(code) {
    var fancyOperator = {
        "+": "+",
        "-": "\u2212",  // −
        "*": "\u00d7",  // ×
        "/": "\u00f7"   // ÷
    };

    function convert(obj) {
        switch (obj.type) {
        case "number":
            return span("num", [obj.value]);
        case "+": case "-": case "*": case "/":
            return span("expr", [convert(obj.left),
                                 fancyOperator[obj.type],
                                 convert(obj.right)]);
        case "name":
            return span("var", [obj.id]);
        }
    }
    return convert(parse(code));
}


// ### 3. MathML output
//
// One more riff on this theme: How about generating beautiful MathML output?
// (Unfortunately, some browsers still do not support MathML. Firefox does.)

// The hardest part of this was figuring out how to make MathML elements.
// Here’s some code to help with that.
var mathml = "http://www.w3.org/1998/Math/MathML";

function mo(s) {
    var e = document.createElementNS(mathml, "mo");
    var t = document.createTextNode(s);
    e.appendChild(t);
    return {prec: 3, element: e};
}

// Create a new MathML DOM element of the specified type and contents.
// `precedence` is used to determine whether or not to add parentheses around
// any of the contents. If it’s `null`, no parentheses are added.
function make(name, precedence, contents) {
    var e = document.createElementNS(mathml, name);
    for (var i = 0; i < contents.length; i++) {
        var kid = contents[i];
        var node;

        if (typeof kid === "string") {
            node = document.createTextNode(kid);
        } else {
            // If precedence is non-null and higher than this child’s
            // precedence, wrap the child in parentheses.
            if (precedence !== null
                && (kid.prec < precedence
                    || (kid.prec == precedence && i != 0)))
            {
                kid = make("mrow", null, [mo("("), kid, mo(")")]);
            }
            node = kid.element;
        }
        e.appendChild(node);
    }
    if (precedence === null)
        precedence = 3;
    return {prec: precedence, element: e};
}

function convertToMathML(code) {
    function convert(obj) {
        switch (obj.type) {
        case "number":
            return make("mn", 3, [obj.value]);
        case "name":
            return make("mi", 3, [obj.id]);
        case "+":
            return make("mrow", 1, [convert(obj.left),
                                    make("mo", 3, ["+"]),
                                    convert(obj.right)]);
        case "-":
            return make("mrow", 1, [convert(obj.left),
                                    make("mo", 3, ["-"]),
                                    convert(obj.right)]);
        case "*":
            return make("mrow", 2, [convert(obj.left),
                                    convert(obj.right)]);
        case "/":
            return make("mfrac", null, [convert(obj.left), convert(obj.right)]);
        }
    };
    var e = convert(parse(code));
    return make("math", null, [e]);
}


// ## Interpreters

// ### 4. Evaluate using floating-point numbers

// Now let’s try actually performing some computation using the program we
// read. This behaves like a stripped-down version of JavaScript `eval()`.
function evaluateAsFloat(code) {
    var variables = Object.create(null);
    variables.e = Math.E;
    variables.pi = Math.PI;

    function evaluate(obj) {
        switch (obj.type) {
        case "number":  return parseInt(obj.value);
        case "name":  return variables[obj.id] || 0;
        case "+":  return evaluate(obj.left) + evaluate(obj.right);
        case "-":  return evaluate(obj.left) - evaluate(obj.right);
        case "*":  return evaluate(obj.left) * evaluate(obj.right);
        case "/":  return evaluate(obj.left) / evaluate(obj.right);
        }
    }
    return evaluate(parse(code));
}

assert.strictEqual(evaluateAsFloat("2 + 2"), 4);
assert.strictEqual(evaluateAsFloat("3 * 4 * 5"), 60);
assert.strictEqual(evaluateAsFloat("5 * (2 + 2)"), 20);


// ### 5. Evaluate using precise fraction arithmetic
//
// Our little language is a tiny subset of JavaScript. But that doesn’t meant
// it has to behave exactly like JavaScript. This is our language.
// It can behave however we want.

// So how about a calculator that does arbitrary precision arithmetic?
// Let’s start by defining a `Fraction` class...

var BigInteger = biginteger.BigInteger;

function gcd(a, b) {
    while (!b.isZero()) {
        var tmp = a;
        a = b;
        b = tmp.remainder(b);
    }
    return a;
}

function Fraction(n, d) {
    if (d === undefined)
        d = new BigInteger(1);
    var x = gcd(n.abs(), d);  // Simplify the fraction.
    this.n = n.divide(x);
    this.d = d.divide(x);
}

// …and some Fraction methods. You learned these techniques in grade school,
// though you may have forgotten some of them.
Fraction.prototype = {
    add: function (x) {
        return new Fraction(this.n.multiply(x.d).add(x.n.multiply(this.d)),
                            this.d.multiply(x.d));
    },
    negate: function (x) {
        return new Fraction(this.n.negate(), this.d);
    },
    sub: function (x) {
        return this.add(x.negate());
    },
    mul: function (x) {
        return new Fraction(this.n.multiply(x.n), this.d.multiply(x.d));
    },
    div: function (x) {
        return new Fraction(this.n.multiply(x.d), this.d.multiply(x.n));
    },
    toString: function () {
        var ns = this.n.toString(), ds = this.d.toString();
        if (ds === "1")
            return ns;
        else
            return ns + "/" + ds;
    }
};

// Now simply write an interpreter that computes the results using `Fraction`
// objects rather than JavaScript numbers. It’s almost too easy.
function evaluateAsFraction(code) {
    function evaluate(obj) {
        switch (obj.type) {
        case "number":  return new Fraction(new BigInteger(obj.value));
        case "+":  return evaluate(obj.left).add(evaluate(obj.right));
        case "-":  return evaluate(obj.left).sub(evaluate(obj.right));
        case "*":  return evaluate(obj.left).mul(evaluate(obj.right));
        case "/":  return evaluate(obj.left).div(evaluate(obj.right));
        case "name":  throw new SyntaxError("no variables in fraction mode, sorry");
        }
    }
    return evaluate(parse(code));
}

// Our tiny programming language is suddenly doing something JavaScript itself
// doesn’t do: arithmetic with exact (not floating-point) results.  Tests:
assert.strictEqual(evaluateAsFraction("1 / 3").toString(), "1/3");
assert.strictEqual(evaluateAsFraction("(2/3) * (3/2)").toString(), "1");
assert.strictEqual(evaluateAsFraction("1/7 + 4/7 + 2/7").toString(), "1");
assert.strictEqual(
    evaluateAsFraction("5996788328646786302319492 / 2288327879043508396784319").toString(),
    "324298349324/123749732893");


// ## Compilers

// ### 6. JavaScript function output

// This is just to show some very basic code generation.
//
// Code generation for a real compiler will be harder, because the target
// language is typically quite a bit different from the source language. Here
// they are virtually identical, so code generation is very easy.
//
function compileToJSFunction(code) {
    function emit(obj) {
        switch (obj.type) {
        case "number":
            return obj.value;
        case "name":
            // Only allow the name "x".
            if (obj.id !== "x")
                throw SyntaxError("only the name 'x' is allowed");
            return obj.id;
        case "+": case "-": case "*": case "/":
            return "(" + emit(obj.left) + " " + obj.type + " " + emit(obj.right) + ")";
        }
    }

    return Function("x", "return " + emit(parse(code)) + ";");
}

assert.strictEqual(compileToJSFunction("x*x - 2*x + 1")(1), 0);
assert.strictEqual(compileToJSFunction("x*x - 2*x + 1")(2), 1);
assert.strictEqual(compileToJSFunction("x*x - 2*x + 1")(3), 4);
assert.strictEqual(compileToJSFunction("x*x - 2*x + 1")(4), 9);


// ### 7. Complex function output

// This one returns a JS function that operates on complex numbers.
//
// This is a more advanced example of a compiler. It has a lowering phase
// and a few simple optimizations.
//
// The input string `code` is a formula, for example, `"(z+1)/(z-1)"`,
// that uses a complex variable `z`.
//
// This returns a JS function that takes two arguments, `z_re` and `z_im`,
// the real and imaginary parts of a complex number *z*,
// and returns an object `{re: some number, im: some number}`,
// representing the complex result of computing the input formula,
// (*z*+1)/(*z*-1). Here is the actual output in that case:
//
//     (function anonymous(z_re, z_im) {
//     var t0 = (z_re+1);
//     var t1 = (z_re-1);
//     var t2 = (z_im*z_im);
//     var t3 = ((t1*t1)+t2);
//     return {re: (((t0*t1)+t2)/t3), im: (((z_im*t1)-(t0*z_im))/t3)};
//     })
//
function compileToComplexFunction(code) {
    // The first thing here is a lot of code about "values". This takes some
    // explanation.
    //
    // `compileToComplexFunction` works in three steps.
    //
    // 1. It uses `parse` as its front end. We get an AST that represents
    //    operations on complex numbers.
    //
    // 2. Then, it **lowers** the AST to an *intermediate representation* (IR)
    //    that’s sort of halfway between the AST and JS code.
    //
    //    The IR here is an array of *values*, basic arithmetic operations on
    //    plain old JS floating-point numbers. If we end up needing JS to
    //    compute `(z_re + 1) * (z_re - 1), then each subexpression there ends
    //    up being a value, represented by an object in the IR.
    //
    //    Once we have the IR, we can throw away the AST. The IR represents the
    //    same formula, but in a different form. Lowering breaks down complex
    //    arithmetic into sequences of JS numeric operations.  JS won't know
    //    it's doing complex math.
    //
    // 3. Lastly, we convert the IR to JS code.
    //
    // **Why lowering?** We don't have to do it this way; we could define a
    // class `Complex`, with methods `.add()`, `.sub()`, etc., and generate JS
    // code that uses that.  Lowering leads to faster JS code: we'll generate
    // code here that does not allocate any objects for intermediate results.

    // #### About the IR
    //
    // Before we implement lower(), we need to define objects representing
    // values. (We could just use strings of JS code, but it turns
    // out to be really complicated, and it's hard to apply even basic
    // optimizations to strings.)
    //
    // We call these instructions "values".  Each value represents a single JS
    // expression that evaluates to a number.  A value is one of:
    //
    //   1. `z_re` or `z_im`, the real or imaginary part of the argument z; or
    //   2. a numeric constant; or
    //   3. an arithmetic operation, one of `+ - * /`, on two previously-
    //      calculated values.
    //
    // And each value is represented by a plain old JSON object, as follows:
    //
    //   1. `{type: "arg", arg0: "z_re"` or `"z_im"}`
    //   2. `{type: "number", arg0: (string picture of number)}`
    //   3. `{type: (one of "+" "-" "*" "/"), arg0: (int), arg1: (int)}`
    //
    // All values are stored sequentially in the array `values`.  The two ints
    // `v.arg0` and `v.arg1` in an arithmetic value are indexes into `values`.
    //
    // The main reason to store all values in a flat array, rather than a tree,
    // is for "common subexpression elimination" (see valueToIndex).
    //
    var values = [
        {type: "arg", arg0: "z_re", arg1: null},
        {type: "arg", arg0: "z_im", arg1: null}
    ];

    // `values(n1, n2)` returns true if the two arguments `n1` and `n2` are
    // equal values—that is, if it would be redundant to compute them both,
    // because they are certain to have the same result.
    //
    // (This could be more sophisticated; it does not detect, for example, that
    // a+1 is equal to 1+a.)
    //
    function valuesEqual(n1, n2) {
        return n1.type === n2.type && n1.arg0 === n2.arg0 && n1.arg1 === n2.arg1;
    }

    // Return the index of `v` within `values`, adding it to `values` if needed.
    function valueToIndex(v) {
        // Common subexpression elimination. If we have already computed this
        // exact value, instead of computing it again, just reuse the already-
        // computed value.
        for (var i = 0; i < values.length; i++) {
            if (valuesEqual(values[i], v))
                return i;
        }

        // We have not already computed this value, so add the value to
        // the list.
        values.push(v);
        return values.length - 1;
    }

    function num(s) {
        return valueToIndex({type: "number", arg0: s, arg1: null});
    }

    function op(op, a, b) {
        return valueToIndex({type: op, arg0: a, arg1: b });
    }

    function isNumber(i) {
        return values[i].type === "number";
    }

    function isZero(i) {
        return isNumber(i) && values[i].arg0 === "0";
    }

    function isOne(i) {
        return isNumber(i) && values[i].arg0 === "1";
    }

    function add(a, b) {
        if (isZero(a))  // simplify (0+b) to b
            return b;
        if (isZero(b))  // simplify (a+0) to a
            return a;
        if (isNumber(a) && isNumber(b))  // constant-fold (1+2) to 3
            return num(String(Number(values[a].arg0) + Number(values[b].arg0)));
        return op("+", a, b);
    }

    function sub(a, b) {
        if (isZero(b))  // simplify (a-0) to a
            return a;
        if (isNumber(a) && isNumber(b))  // constant-fold (3-2) to 1
            return num(String(Number(values[a].arg0) - Number(values[b].arg0)));
        return op("-", a, b);
    }

    function mul(a, b) {
        if (isZero(a))  // simplify 0*b to 0
            return a;
        if (isZero(b))  // simplify a*0 to 0
            return b;
        if (isOne(a))  // simplify 1*b to b
            return b;
        if (isOne(b))  // simplify a*1 to a
            return a;
        if (isNumber(a) && isNumber(b))  // constant-fold (2*2) to 4
            return num(String(Number(values[a].arg0) * Number(values[b].arg0)));
        return op("*", a, b);
    }

    function div(a, b) {
        if (isOne(b))  // simplify a/1 to a
            return a;
        if (isNumber(a) && isNumber(b) && !isZero(b))  // constant-fold 4/2 to 2
            return num(String(Number(values[a].arg0) / Number(values[b].arg0)));
        return op("/", a, b);
    }

    // Reduce obj, which represents an operation on complex numbers,
    // to a pair of expressions on floating-point numbers.
    function ast_to_ir(obj) {
        switch (obj.type) {
        case "number":
            return {re: num(obj.value), im: num("0")};

        case "+": case "-":
            var a = ast_to_ir(obj.left), b = ast_to_ir(obj.right);
            var f = (obj.type === "+" ? add : sub);
            return {
                re: f(a.re, b.re),
                im: f(a.im, b.im)
            };

        case "*":
            var a = ast_to_ir(obj.left), b = ast_to_ir(obj.right);
            return {
                re: sub(mul(a.re, b.re), mul(a.im, b.im)),
                im: add(mul(a.re, b.im), mul(a.im, b.re))
            };

        case "/":
            var a = ast_to_ir(obj.left), b = ast_to_ir(obj.right);
            var t = add(mul(b.re, b.re), mul(b.im, b.im));
            return {
                re: div(add(mul(a.re, b.re), mul(a.im, b.im)), t),
                im: div(sub(mul(a.im, b.re), mul(a.re, b.im)), t)
            };

        case "name":
            if (obj.id === "i")
                return {re: num("0"), im: num("1")};
            if (obj.id !== "z")
                throw SyntaxError("undefined variable: " + obj.id);
            // A little subtle here: values[0] is z_re; values[1] is z_im.
            return {re: 0, im: 1};
        }
    }

    function computeUseCounts(values) {
        var binaryOps = {"+": 1, "-": 1, "*": 1, "/": 1};
        var useCounts = [];
        for (var i = 0; i < values.length; i++) {
            useCounts[i] = 0;
            var node = values[i];
            if (node.type in binaryOps) {
                useCounts[node.arg0]++;
                useCounts[node.arg1]++;
            }
        }
        return useCounts;
    }

    function ir_to_js(values, result) {
        var useCounts = computeUseCounts(values);
        var code = "";
        var next_temp_id = 0;
        var js = [];
        for (var i = 0; i < values.length; i++) {
            var node = values[i];
            if (node.type === "number" || node.type === "arg") {
                js[i] = node.arg0;
            } else {
                js[i] = "(" + js[node.arg0] + node.type + js[node.arg1] + ")";
                if (useCounts[i] > 1) {
                    var name = "t" + next_temp_id++;
                    code += "var " + name + " = " + js[i] + ";\n";
                    js[i] = name;
                }
            }
        }
        code += "return {re: " + js[result.re] + ", im: " + js[result.im] + "};\n";
        return code;
    }

    var ast = parse(code);
    var result = ast_to_ir(ast);
    var code = ir_to_js(values, result);
    console.log(code);
    return Function("z_re, z_im", code);

    /*
      I had planned to have this generate asm.js code for extra speed, but it's
      so fast already that unless I can think of a more computationally
      intensive task, there is no need.
    */
}

// The last bit of code here simply stores all seven back ends in one place
// where other code can get to them.
var parseModes = {
    json: convertToJSON,
    blocks: convertToDOM,
    mathml: convertToMathML,
    calc: evaluateAsFloat,
    fraction: evaluateAsFraction,
    graph: compileToJSFunction,
    complex: compileToComplexFunction
};

function evaluateAsFloat(code) {
    var variables = Object.create(null);
    variables.e = Math.E;
    variables.pi = Math.PI;

    function evaluate(obj) {
        switch (obj.type) {
        case "number":  return parseInt(obj.value);
        case "name":  return variables[obj.id] || 0;
        case "+":  return evaluate(obj.left) + evaluate(obj.right);
        case "-":  return evaluate(obj.left) - evaluate(obj.right);
        case "*":  return evaluate(obj.left) * evaluate(obj.right);
        case "/":  return evaluate(obj.left) / evaluate(obj.right);
        }
    }
    return evaluate(parse(code));
}
var evald = evaluateAsFloat(equ);
return evald;});
