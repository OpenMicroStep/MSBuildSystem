# Component final injection

This file provide the injection algorithm to do the final resolution of components.

#### injectElements

Inject `elements` attributes into `into`.

 - `path` is the attribute path of `into`.
 - `buildTarget` allow the resolution of `*ByEnvironment` attributes
 - `mapKey` allow renaming or removing an attribute before injection  
   By default, private (`__`*), _tags_, _elements_ and _environments_ attributes are removed (see _notInjectableKeys_)
 - `mapValue` allow changing the value before injection

Here is the injection algorithm:

    for each attribute in element
      attribute = mapKey(attribute)
      if !attribute
        continue to the next attribute
      
      if attribute ends with "ByEnvironment"
        will_inject_value = array of matching environments values
      else
        will_inject_value = mapValue(element[attribute])
      current_value = into[attribute]

      if current_value exists
        if will_inject_value and current_value are both array
          append will_inject_value values to current_value
        else if current_value was added in the current function call
          if current_value != will_inject_value there is an incoherence
      else
        into[attribute] = will_inject_value



#### injectComponentsOf

Inject `component` components into `into` recursively. See `injectElements` for parameters details.
