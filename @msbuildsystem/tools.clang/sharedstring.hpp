namespace tools { namespace clang {

#include <clang-c/Index.h>
#include <string>

class String {
private:
  uint16_t size;
  char str[0];
  String(const String&o) = delete;
public:
  String* from(const char *str, size_t len)
  {

  }
  String()
  {
    size = 0;
  }
  SmallString(const char *str, size_t len)
  {
    size = (uint16_t)len;
    char *dst = (size >= Len)
      ? heap = new char[len + 1]
      : stack;
    memcpy(dst, str, len + 1);
  }
  const char *c_str() const
  {
    return size >= Len ? heap : stack;
  }
  size_t size() const
  {
    return size;
  }
}

class SharedString : private SmallString<32> {
private:
  SharedString();
public:
  SharedString(const SharedString& that);
  SharedString from(const char *str);
  SharedString from(const std::string &str);
  SharedString from(const CXString &str);
  SharedString from(const char *str, size_t len);
};

bool operator==( SharedString& lhs, SharedString& rhs );
bool operator!=( SharedString& lhs, SharedString& rhs );
bool operator<( SharedString& lhs, SharedString& rhs );
bool operator<=( SharedString& lhs, SharedString& rhs );
bool operator>( SharedString& lhs, SharedString& rhs );
bool operator>=( SharedString& lhs, SharedString& rhs );

SharedString SharedString::from(const std::string &str)
{
  return from(str.c_str(), str.length());
}

SharedString SharedString::from(const char *str)
{
  return from(str, strlen(str));
}

SharedString SharedString::from(const CXString &str)
{
  SharedString ret = from(clang_getCString(str));
  clang_disposeString(str);
  return ret;
}

SharedString SharedString::from(const char *str, size_t len)
{

}

inline bool operator==( SharedString& lhs, SharedString& rhs );
inline bool operator!=( SharedString& lhs, SharedString& rhs )
{
  return !(lhs == rhs);
}
bool operator<( SharedString& lhs, SharedString& rhs );
bool operator<=( SharedString& lhs, SharedString& rhs );
bool operator>( SharedString& lhs, SharedString& rhs );
bool operator>=( SharedString& lhs, SharedString& rhs );

}} // end namespace tools::clang