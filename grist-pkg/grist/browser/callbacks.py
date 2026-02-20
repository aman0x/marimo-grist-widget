import asyncio
import builtins
import inspect
import sys
import traceback
import warnings
from functools import partial

import js
import pyodide_js
from pyodide.ffi import to_js, create_proxy

from .utils import maybe_await

original_print = print

try:
    import IPython.core.display_functions
    import IPython.display
    from IPython import get_ipython
    original_display = IPython.display.display
    ipython = get_ipython()
    if ipython:
        ipython.display_formatter.formatters["text/plain"].for_type(
            str, lambda string, pp, cycle: pp.text(string)
        )
    HAS_IPYTHON = ipython is not None
except (ImportError, AttributeError):
    HAS_IPYTHON = False
    original_display = print

lock = asyncio.Lock()


def skip_traceback_internals(tb):
    filename = (lambda: 0).__code__.co_filename
    original = tb
    while tb and tb.tb_frame.f_code.co_filename == filename:
        tb = tb.tb_next
    if tb:
        return tb
    else:
        return original


def wrap_with_display(func):
    if not HAS_IPYTHON:
        async def simple_wrapper(*args):
            try:
                await maybe_await(func(*args))
            except Exception as e:
                print("".join(traceback.format_exception(
                    e.__class__, e, skip_traceback_internals(e.__traceback__)
                )))
        return simple_wrapper

    handles = [original_display(display_id=True) for _ in range(45)]

    def in_wrapper_frame():
        frame = inspect.currentframe().f_back
        while frame:
            if frame.f_code == inner_wrapper.__code__:
                return True
            frame = frame.f_back

    async def inner_wrapper(*args):
        for handle in handles:
            handle.update({}, raw=True)

        i = 0

        def displayer(*objs, **kwargs):
            nonlocal i
            if not in_wrapper_frame():
                return original_display(*objs, **kwargs)

            for obj in objs:
                if i == len(handles) - 1:
                    handles[i].update("Too many display calls!")
                else:
                    handles[i].update(obj, **kwargs)
                    i += 1

        def new_print(*print_args, sep=" ", end="\n", **kwargs):
            if not in_wrapper_frame():
                return original_print(*print_args, sep=sep, end=end, **kwargs)

            if len(print_args) == 1 and end == "\n":
                displayer(print_args[0])
            else:
                displayer(sep.join(map(str, print_args)) + end)

        async with lock:
            builtins.print = new_print
            patched_modules = []
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                for module in list(sys.modules.values()):
                    try:
                        if (
                            HAS_IPYTHON
                            and module != IPython.core.display_functions
                            and getattr(module, "display", "") == original_display
                        ):
                            module.display = displayer
                            patched_modules.append(module)
                    except:
                        pass

            try:
                await maybe_await(func(*args))
            except Exception as e:
                displayer(
                    "".join(
                        traceback.format_exception(
                            e.__class__, e, skip_traceback_internals(e.__traceback__)
                        )
                    )
                )
            finally:
                builtins.print = original_print
                for module in patched_modules:
                    module.display = original_display

    return inner_wrapper


callback_registry = dict(
    onRecords={},
    onRecord={},
)


async def on_records_dispatch(grist, *_):
    records = await grist.fetch_selected_table()
    for callback in callback_registry["onRecords"].values():
        await callback(records)


async def on_record_dispatch(grist, record, *_rest):
    if not record:
        return

    record = await grist.fetch_selected_record(record["id"])
    for callback in callback_registry["onRecord"].values():
        await callback(record)


last_registering_cell_filename = None


def check_registering_cell():
    pass


async def add_to_callback_registry(grist, name, callback):
    registry = callback_registry[name]
    if callback.__name__ in registry:
        print(
            f"A callback named {callback.__name__} has already been registered, so I'm assuming "
            "you want to replace it. If not, please rename the function.\n"
        )
    wrapped = wrap_with_display(callback)
    if not registry:
        dispatch = dict(
            onRecords=on_records_dispatch,
            onRecord=on_record_dispatch,
        )[name]
        method = getattr(grist.raw, name)
        await method(partial(dispatch, grist))
    registry[callback.__name__] = wrapped
    return wrapped
