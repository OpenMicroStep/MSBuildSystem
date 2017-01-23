namespace tools {
  namespace clang {

class Context {
private:

public:
  struct CStrLess {
    bool operator()(const char * lhs, const char * rhs) const
    {
      return strcmp(lhs, rhs) < 0;
    }
  };
  struct CStrHash {
    std::size_t operator()(const char * k) const
    {
      std::size_t hash = 0x9e3779b9U, tmp;
      //return *k;
      char c1, c2 = 1; const char *c = k;

      while (c2 && (c1= *(c++))) {
        if((c2= (*c++))) {
          hash+= c1;
          tmp= (c2 << 11) ^ hash;
          hash= (hash << 16) ^ tmp;
          hash+= hash >> 11;
        } else {
          hash+= c1;
          hash^= hash << 11;
          hash+= hash >> 17;
        }
      }

      /* Force "avalanching" of final 31 bits */
      hash ^= hash << 3;
      hash += hash >> 5;
      hash ^= hash << 2;
      hash += hash >> 15;
      hash ^= hash << 10;

      return hash;
    }
  };

  struct CStrEqual {
    bool operator()(const char * lhs, const char * rhs) const
    {
      return strcmp(lhs, rhs) == 0;
    }
  };
  struct DeclarationLess {
    bool operator()(std::string* lhs, std::string* rhs) const
    {
      return *lhs < *rhs;
    }
  };

  Declaration *current;
  std::map<std::string*, std::unique_ptr<Declaration>> shared_declarations;
  std::unordered_map<Location, unsigned, LocationHash, LocationEqual> declarations;
  std::unordered_map<Location, unsigned, LocationHash, LocationEqual> references;
  std::unordered_map<const char *, std::unique_ptr<std::string>, CStrHash, CStrEqual> strings;
  TUnit *tu;
  Context()
  {
    this->current = NULL;
  }

  Declaration * shared_declaration(CXCursor cursor)
  {
    std::string *usr= memory_optimized_string(clang_getCursorUSR(cursor));
    auto it = shared_declarations.find(usr);
    if (it == shared_declarations.end()) {
      std::string *name = memory_optimized_string(clang_getCursorSpelling(cursor));
      if (current)
        current->ref++;
      it = shared_declarations.emplace(std::make_pair(usr, std::unique_ptr<Declaration>(new Declaration(usr, name, clang_getCursorKind(cursor), current)))).first;
    }
    return it->second.get();
  }

  Declaration * add_declaration(CXCursor cursor) {
    Declaration *decl = shared_declaration(cursor);
    decl->ref++;
    //tu->declarations.push_back(add_location(declarations, Location(*this, cursor, decl)));
    return decl;
  }

  void clear_tu() {
    for(auto l: tu->declarations)
      rm_declaration(l);
    tu->declarations.clear();
    for(auto l: tu->references)
      rm_reference(l);
    tu->references.clear();
  }

  void rm_declaration(const Location *loc) {
    rm_location(declarations, loc);
  }

  void add_reference(CXCursor cursor) {
    Declaration *decl = shared_declaration(clang_getCursorReferenced(cursor));
    decl->ref++;
    //tu->references.push_back(add_location(references, Location(*this, cursor, decl)));
  }

  void rm_reference(const Location *loc) {
    rm_location(references, loc);
  }

  void rm_shared_declaration(Declaration *decl) {
    if (!decl)
      return;
    if (--decl->ref == 0) {
      rm_shared_declaration(decl->parent);
      shared_declarations.erase(decl->usr);
    }
  }
  void rm_location(std::unordered_map<Location, unsigned, LocationHash, LocationEqual> &list, const Location *loc) {
    auto it = list.find(*loc);
    assert(it != list.end());
    rm_shared_declaration(it->first.declaration);
    if (--it->second == 0)
      list.erase(it);
  }

  const Location *add_location(std::unordered_map<Location, unsigned, LocationHash, LocationEqual> &list, Location &&location) {
    auto it = list.emplace(std::make_pair(location, 1));
    if (!it.second)
      it.first->second++;
    return &it.first->first;
  }

  std::string * memory_optimized_string(CXString source, bool dispose = true)
  {
    std::string *ret;
    const char *cstr = clang_getCString(source);
    if (cstr) {
      auto it = strings.find(cstr);
      if (it == strings.end()) {
        ret= new std::string(cstr);
        strings.emplace(std::make_pair(ret->c_str(), std::unique_ptr<std::string>(ret)));
      }
      else {
        ret= it->second.get();
      }
    }
    else {
      ret = NULL;
    }
    if (dispose)
      clang_disposeString(source);
    return ret;
  }
};
  }
}