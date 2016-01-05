


EVHTTPD_H= \
 AbstractIOPump.h \
 AbstractIOReader.h \
 AbstractIOWriter.h \
 ChunkedBodyBuilder.h \
 CleanerTimer.h \
 Config.h \
 Dispatcher.h \
 events.h \
 evhttp.h \
 EvNIOReader.h \
 EvNIOWriter.h \
 HttpHandler.h \
 HttpHandlerFactory.h \
 HttpHandlerManager.h \
 HttpProcess.h \
 HttpServer.h \
 HttpServlet.h \
 HttpServletFactory.h \
 HttpServletManager.h \
 HttpUtils.h \
 IBodyBuilder.h \
 ICleaner.h \
 IIOPump.h \
 IIOReader.h \
 IIOWriter.h \
 IRunnable.h \
 KeyValues.h \
 log.h \
 MemoryPool.h \
 Process.h \
 ProcessFDSender.h \
 Queue.h \
 Request.h \
 RequestData.h \
 resources.h \
 Response.h \
 RWIOPump.h \
 SendfileIOPump.h \
 SocketUtils.h \
 StringUtils.h \
 SocketNIOReader.h \
 SocketNIOWriter.h \
 libev.h \
 ProcessSignal.h \
 Timer.h 


EVHTTPD_EVENT_H= \
 event/Event.h \
 event/EventDispatcher.h \
 event/IEventDispatcher.h \
 event/IEventListener.h 

EVHTTPD_HTTP10_H= \
 http_1.0/Http10Handler.h \
 http_1.0/Http10HandlerFactory.h 

EVHTTPD_HTTP11_H= \
 http_1.1/Http11Handler.h \
 http_1.1/Http11HandlerFactory.h 


EVHTTPD_CPP = \
 AbstractIOPump.cpp \
 ChunkedBodyBuilder.cpp \
 CleanerTimer.cpp \
 Dispatcher.cpp \
 event/EventDispatcher.cpp \
 EvNIOReader.cpp \
 EvNIOWriter.cpp \
 HttpHandler.cpp \
 HttpHandlerFactory.cpp \
 HttpHandlerManager.cpp \
 HttpProcess.cpp \
 HttpServer.cpp \
 HttpServletManager.cpp \
 HttpUtils.cpp \
 http_1.0/Http10Handler.cpp \
 http_1.0/Http10HandlerFactory.cpp \
 http_1.1/Http11Handler.cpp \
 http_1.1/Http11HandlerFactory.cpp \
 MemoryPool.cpp \
 Process.cpp \
 ProcessFDSender.cpp \
 Request.cpp \
 RequestData.cpp \
 Response.cpp \
 RWIOPump.cpp \
 SendfileIOPump.cpp \
 SocketUtils.cpp \
 StringUtils.cpp \
 SocketNIOReader.cpp \
 SocketNIOWriter.cpp \
 ProcessSignal.cpp \
 Timer.cpp 

AUTOMAKE_OPTIONS=foreign
#RANLIB=ranlib
LIBTOOL=libtool
LDFLAGS=-lev -lrt -Wno-deprecated
CXXFLAGS += -Wno-deprecated

#bin_PROGRAMS=evhttp
#evhttp_SOURCES= ${EVHTTPD_H} ${EVHTTPD_CPP} 

#lib_LIBRARIES = libevhttp.a
#libevhttp_a_SOURCES= ${EVHTTPD_H} ${EVHTTPD_CPP}

lib_LTLIBRARIES = libevhttp.la
libevhttp_la_SOURCES = ${EVHTTPD_H} ${EVHTTPD_EVENT_H} ${EVHTTPD_HTTP10_H} ${EVHTTPD_HTTP11_H} ${EVHTTPD_CPP} 

 
libevhttpincludedir = $(includedir)/evhttp
libevhttpinclude_HEADERS = ${EVHTTPD_H}

libevhttpeventincludedir = $(includedir)/evhttp/event
libevhttpeventinclude_HEADERS = ${EVHTTPD_EVENT_H}
 
libevhttphttp10includedir = $(includedir)/evhttp/http_1.0
libevhttphttp10include_HEADERS = ${EVHTTPD_HTTP10_H}

libevhttphttp11includedir = $(includedir)/evhttp/http_1.1
libevhttphttp11include_HEADERS = ${EVHTTPD_HTTP11_H}



