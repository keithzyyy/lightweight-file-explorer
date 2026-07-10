





## Spread operator "..."
> The spread operator ... has been introduced with ES2015 and is used to **expand elements of an iterable (like an array)** into places where multiple elements can fit.
```js
// Example 1
const arr1 = ["a", "b", "c"];
const arr2 = [...arr1, "d", "e", "f"]; // ["a", "b", "c", "d", "e", "f"]

// Example 2
function myFunc(x, y, ...params) {
  console.log(x);
  console.log(y);
  console.log(params)
}

myFunc("a", "b", "c", "d", "e", "f")
// "a"
// "b"
// ["c", "d", "e", "f"]
```

## Resources
- [Modern JS cheatsheet](https://github.com/mbeaudru/modern-js-cheatsheet#arrayprototypemap)