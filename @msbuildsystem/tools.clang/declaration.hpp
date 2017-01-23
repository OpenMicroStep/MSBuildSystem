namespace tools { namespace clang {

class Declaration {
private:
  /** Unified Symbol Resolution */
  SharedString usr;

  /** Parent declaration that contains this one */
  Declaration *parent;

  /** Kind of declaration */
  CXCursorKind kind;

  /** Name of the declaration */
  SharedString name;

public:
  Declaration(SharedString usr, SharedString name, CXCursorKind kind, Declaration *parent)
  {
    this->usr = usr;
    this->kind = kind;
    this->parent = parent;
    this->name = name;
  }
  Declaration(const Declaration& that) = delete; // no copy constructor
};

}} // end namespace tools::clang