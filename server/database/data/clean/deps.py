try:
    from scipy.interpolate import UnivariateSpline  # noqa: F401
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

try:
    from statsmodels.nonparametric.smoothers_lowess import lowess as sm_lowess  # noqa: F401
    HAS_LOWESS = True
except ImportError:
    HAS_LOWESS = False

try:
    import libpysal  # noqa: F401
    HAS_LIBPYSAL = True
except ImportError:
    HAS_LIBPYSAL = False
