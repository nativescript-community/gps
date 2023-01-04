#import "NSDate+BootTime.h"

#include <sys/types.h>
#include <sys/sysctl.h>

@implementation NSDate (BootTime)

+ (NSDate *)bootTime {
    return [NSDate dateWithTimeIntervalSinceReferenceDate:[NSDate bootTimeTimeIntervalSinceReferenceDate]];
}

+ (NSTimeInterval)bootTimeTimeIntervalSinceReferenceDate {
    return getKernelTaskStartTime();
}

////////////////////////////////////////////////////////////////////////
#pragma mark - Private
////////////////////////////////////////////////////////////////////////

#define COUNT_ARRAY_ELEMS(arr) sizeof(arr)/sizeof(arr[0])

static CFAbsoluteTime getKernelTaskStartTime(void) {
    enum { MICROSECONDS_IN_SEC = 1000 * 1000 };
    struct kinfo_proc   info;
    bzero(&info, sizeof(info));

    // Initialize mib, which tells sysctl the info we want, in this case
    // we're looking for information about a specific process ID = 0.
    int mib[] = {CTL_KERN, KERN_PROC, KERN_PROC_PID, 0};

    // Call sysctl.
    size_t size = sizeof(info);
    const int sysctlResult = sysctl(mib, COUNT_ARRAY_ELEMS(mib), &info, &size, NULL, 0);
    if (sysctlResult != -1) {

        const struct timeval * timeVal = &(info.kp_proc.p_starttime);
        NSTimeInterval result = -kCFAbsoluteTimeIntervalSince1970;
        result += timeVal->tv_sec;
        result += timeVal->tv_usec / (double)MICROSECONDS_IN_SEC;
        return result;

    }

    return 0;
}

@end