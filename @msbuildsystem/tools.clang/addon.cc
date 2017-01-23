#include <cstdio>
#include <cstdlib>
#include <clang-c/Index.h>
#include <string>
#include <list>
#include <vector>
#include <map>
#include <unordered_map>
#include <unordered_set>
#include <set>
#include <assert.h>
#include <nan.h>
#include <iostream>

namespace clangindex {
  struct Context;
  struct Declaration;
  struct Location {
    std::string *filename;
    unsigned sline, scolumn, eline, ecolumn;
    Declaration *declaration;

    Location(Context &context, CXCursor cursor, Declaration *decl);
  };
  struct LocationHash {
    std::size_t operator()(const Location& l) const
    {
      return (l.filename ? std::hash<std::string>()(*l.filename) : 0)
        ^ (std::hash<unsigned>()(l.sline) << 1)
        ^ (std::hash<unsigned>()(l.scolumn) << 2)
        ^ (std::hash<unsigned>()(l.eline) << 3)
        ^ (std::hash<unsigned>()(l.ecolumn) << 4);
    }
  };
  struct LocationEqual {
    bool operator()(const Location& lhs, const Location& rhs) const
    {
      return lhs.sline == rhs.sline
          && lhs.scolumn == rhs.scolumn
          && lhs.eline == rhs.eline
          && lhs.ecolumn == rhs.ecolumn
          && lhs.filename == rhs.filename
          && lhs.declaration == rhs.declaration;
    }
  };

  struct TUnit {
    const char *src;
    std::vector<const Location*> declarations;
    std::vector<const Location*> references;
    TUnit(const char *src) : src(src) {}
  };
  struct Declaration {
    std::string *usr;
    Declaration *parent;
    CXCursorKind kind;
    std::string *name;
    unsigned ref;

    Declaration(std::string *usr, std::string *name, CXCursorKind kind, Declaration *parent) : ref(0) {
      this->usr = usr;
      this->kind = kind;
      this->parent = parent;
      this->name = name;
    }
    Declaration(const Declaration& that) = delete;
  };

  Location::Location(Context &context, CXCursor cursor, Declaration *decl) : filename(NULL), declaration(decl) {
      CXFile file; unsigned offset;
      CXSourceRange r = clang_getCursorExtent(cursor);
      CXSourceLocation s = clang_getRangeStart(r);
      CXSourceLocation e = clang_getRangeEnd(r);
      clang_getSpellingLocation(s, &file, &sline, &scolumn, &offset);
      clang_getSpellingLocation(e, &file, &eline, &ecolumn, &offset);
      if (file)
        filename = context.memory_optimized_string(clang_getFileName(file));
    }
}
using namespace clangindex;
CXChildVisitResult visitChildrenCallback(CXCursor cursor,
                                         CXCursor parent,
                                         CXClientData client_data) {
  Context &context = *(Context *)client_data;
  Declaration *current = context.current;
  //printf("  Level: %d\n", level);

  CXCursorKind curKind  = clang_getCursorKind(cursor);
  bool isDecl = clang_isDeclaration(curKind) || curKind == CXCursor_MacroDefinition;
  bool isRef = !isDecl && (clang_isReference(curKind) || clang_isPreprocessing(curKind));
  if (isDecl) {
    context.current = context.add_declaration(cursor);
  }
  else if (isRef) {
    context.add_reference(cursor);
  }

  clang_visitChildren(cursor, visitChildrenCallback, &context);
  context.current = current;
  return CXChildVisit_Continue;
}


void show_clang_version(void) {
  CXString version = clang_getClangVersion();
  printf("%s\n", clang_getCString(version));
  clang_disposeString(version);
}

int main(int argc, char **argv) {
  show_clang_version();

  const char *args[] = {
    "-isysroot", "/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX10.11.sdk",
    "--target=x86_64-apple-darwin14.3.0",
    "-I/Users/vincentrouille/Dev/MicroStep/MSFoundation/deps/msstdlib",
    "-I/opt/microstep/darwin-x86_64/debug/include",
    "-I/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src",
    "-I/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src",
    "-DMSCORE_STANDALONE",
    "-DMSSTD_EXPORT",
  };

  TUnit units[] = {
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapm5sin.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapm_add.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapm_cpi.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapm_div.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapm_exp.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapm_fft.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapm_flr.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapm_fpf.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapm_gcd.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapm_lg2.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapm_lg3.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapm_lg4.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapm_log.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapm_mul.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapm_pow.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapm_rcp.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapm_set.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapm_sin.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapmasin.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapmasn0.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapmcbrt.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapmcnst.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapmfact.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapmfmul.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapmgues.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapmhasn.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapmhsin.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapmipwr.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapmistr.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapmpwr2.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapmrsin.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapmsqrt.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapmutil.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapmutl1.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MAPM_src/mapmutl2.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MSCArray.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MSCBuffer.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MSCArray.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MSCColor.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MSCCouple.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MSCDate.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MSCDecimal.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MSCDictionary.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MSCGrow.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MSCMessage.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MSCString.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MSCTraverse.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MSCoreSES.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MSCoreUnichar.c"),
    TUnit("/Users/vincentrouille/Dev/MicroStep/MSFoundation/MSCore_src/MSTE.c"),
  };
  // create index w/ excludeDeclsFromPCH = 1, displayDiagnostics=1.
  CXIndex index = clang_createIndex(1, 1);
  Context context;
  for (int k = 0; k < 2; ++k) {
    for (int i = 0, len = sizeof(units)/sizeof(TUnit); i < len; ++i) {
      CXTranslationUnit tu;
      clang_parseTranslationUnit2(index, units[i].src, args, 9, NULL, 0, CXTranslationUnit_DetailedPreprocessingRecord | CXTranslationUnit_IncludeBriefCommentsInCodeCompletion, &tu);

      CXCursor cursor = clang_getTranslationUnitCursor(tu);
      context.tu = &units[i];
      context.clear_tu();
      clang_visitChildren(cursor, visitChildrenCallback, &context);
      clang_disposeTranslationUnit(tu);
    }
  }

  clang_disposeIndex(index);
  int nb = 0;
  for (int i = 0, len = sizeof(units)/sizeof(TUnit); i < len; ++i) {
    nb += units[i].references.size() + units[i].declarations.size();
  }
  printf("context: %d->%d declarations, %d references, %d strings, %d refs\n"
    , (int)context.shared_declarations.size()
    , (int)context.declarations.size()
    , (int)context.references.size()
    , (int)context.strings.size()
    , nb);
  //sleep(10);
  return 0;
}

void Main(const Nan::FunctionCallbackInfo<v8::Value>& info) {

  if (info.Length() < 2) {
    Nan::ThrowTypeError("Wrong number of arguments");
    return;
  }

  if (!info[0]->IsNumber() || !info[1]->IsNumber()) {
    Nan::ThrowTypeError("Wrong arguments");
    return;
  }

  double arg0 = info[0]->NumberValue();
  double arg1 = info[1]->NumberValue();
  v8::Local<v8::Number> num = Nan::New(arg0 + arg1);
  main(0, nullptr);
  info.GetReturnValue().Set(num);
}

void Init(v8::Local<v8::Object> exports) {
  exports->Set(Nan::New("main").ToLocalChecked(),
               Nan::New<v8::FunctionTemplate>(Main)->GetFunction());
}

NODE_MODULE(clang_indexer, Init)