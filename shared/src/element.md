Element
=======

Every implementation related properties and methods are prefixed by `__`.

Element loading and resolution make heavy use of `AttributeTypes` validator and `AttributePath` tracking capabilities to detect as soon as possible any definition error.

## Attributes

#### `is: string`
The semantic type of the element.

#### `name: string`
The name of the element

#### `tags: string[]`
The list of tags associated to this element.

#### `__parent: Element | null`
The parent element if any.


## Methods

### Instantiation

Instantiation is done in 2 passes: loading elements then resolving references

```
load 
  |-> __load                             <----+
  |     |-> __loadNamespace                   |
  |     +-> __loadValue                       |
  |           |-> __loadArray                 |
  |           |     +-> __loadObjectInArray   |
  |           |           +-> instantiate   --+
  |           +-> __loadObject                |
  |                 +-> instantiate         --+
  +-> __resolve                                    <----+
        +-> __resolveWithPath                           |
        |     +-> __resolveValuesInObject               |
        |           +-> __resolveAnyValue             --+
        |                 |-> __resolveValuesInArray    |
        |                 |     +-> __resolveAnyValue   |
        |                 |     +-> __resolveElements   |
        |                 |     +-> __resolveInto     --+
        |                 |-> __resolveValuesInObject
        |                 |     +-> __resolveAnyValue
        |                 +-> __resolveElements
        +-> __validate
```

#### `static load<T extends Element>(reporter: Reporter, definition: ElementDefinition, root: T, elementFactoriesProviderMap: ElementFactoriesProviderMap): T`

Load _definition_ into _root_ element using _elementFactoriesProviderMap_ to instantiate elements.
The caller is responsible of the `is` and `name` attribute of the _root_ element.  
Diagnostics are reported into the given _reporter_.  

An element factory takes the optional namespace _name_ (ie. "name="), the element definition and the _parent_ element as input and must return the list of instantiated elements (see `ElementFactory` for the complete definition). Instantiated elements must not be either loaded or resolved, it's the caller of the factory method that is responsible to do this job.

To simplify factory creation for the most common pattern: _one definition equal one element_, it is possible to use `registerSimple` that will handle for you the `name` resolution (by calling `handleSimpleElementName`).


#### `__load(context: ElementLoadContext, definition: ElementDefinition, attrPath: AttributePath)`

Load attributes in _definition_ by doing a recursive deep copy of attribute values.
If an attribute name and/or value define an element, then the corresponding factory found in the _context_ is used to instantiate the element.


#### `__resolve(reporter: Reporter)`

If this element hasn't been resolved yet, do the resolution.

Resolving an element means that any reference to other elements with the syntax `=elements path` is resolved and replaced by matching elements.

If a reference doesn't resolve to a least one element, a warning is raised.

### Instance tools

#### `__root() : Element`

Returns the root element.

#### `__path() : string`

Returns the path to this element relative to the root element path.

#### `resolveElements(reporter: Reporter, query: string) : Element[]`

Find matching _query_ elements. Any lookup error are reported into _reporter_.

Queries have the form: 

  - `[group0 [+ groupX]*] [? tag0 [+ tagX]*]`
  - `{ [group0 [+ groupX]*] [? tag0 [+ tagX]*] } +attr0 +attr1`
  - `{ [group0 [+ groupX]*] [? tag0 [+ tagX]*] } -attr0 -attr1`
  - `{ [group0 [+ groupX]*] [? tag0 [+ tagX]*] } .method`

The empty query resolves to no element at all.

The parsing of the query is done by `parseQuery` and the final resolution by `__resolveElementsGroup`.

