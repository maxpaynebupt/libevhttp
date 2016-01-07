#include "logger.h"
int initlog(){
  log4cplus::PropertyConfigurator::doConfigure("./log4cplus.conf");
  return 1;
}
//int a=initlog();
