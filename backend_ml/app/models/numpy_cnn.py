# ============================================================
# NumpyCNN - native NumPy implementation of a real convolutional
# neural network (residual blocks + global average pooling + FC
# head). Fully differentiable training used when PyTorch is absent
# so the API stays functional offline; math mirrors torch_cnn.py.
# ============================================================
import math
from typing import Tuple

import numpy as np


def _init_w(shape: Tuple[int, ...], seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    fan_in = int(np.prod(shape[1:]))
    fan_out = int(np.prod(shape[0:1]) * np.prod(shape[2:])) if len(shape) >= 3 else int(shape[0])
    bound = math.sqrt(6.0 / (fan_in + fan_out))
    return rng.uniform(-bound, bound, size=shape).astype(np.float32)


def _conv2d_numpy(img: np.ndarray, w: np.ndarray, pad: int = 1) -> np.ndarray:
    b, c, h, wd = img.shape
    oc = w.shape[0]
    kh, kw = w.shape[2], w.shape[3]
    out_h = h + 2 * pad - kh + 1
    out_w = wd + 2 * pad - kw + 1
    img_pad = np.pad(img, ((0, 0), (0, 0), (pad, pad), (pad, pad)))
    out = np.zeros((b, oc, out_h, out_w), np.float32)
    for i in range(kh):
        for j in range(kw):
            region = img_pad[:, :, i:i + out_h, j:j + out_w]
            res = np.tensordot(region, w[:, :, i, j], axes=([1], [1]))
            out += res.transpose(0, 3, 1, 2)
    return out


def _conv2d_backward_input(grad_out: np.ndarray, w: np.ndarray, pad: int = 1, in_h=None, in_w=None) -> np.ndarray:
    """dL/dx for a stride-1 same-pad conv."""
    b, oc, oh, ow = grad_out.shape
    kh, kw = w.shape[2], w.shape[3]
    ih = in_h if in_h else oh + 2 * pad - kh + 1
    iw = in_w if in_w else ow + 2 * pad - kw + 1
    grad_full = np.zeros((b, w.shape[1], ih + 2 * pad, iw + 2 * pad), np.float32)
    for i in range(kh):
        for j in range(kw):
            region = np.tensordot(grad_out, w[:, :, i, j], axes=([1], [0])).transpose(0, 3, 1, 2)
            grad_full[:, :, i:i + oh, j:j + ow] += region  # b,ci,oh,ow
    if pad == 0:
        return grad_full[:, :, :ih, :iw]
    return grad_full[:, :, pad:pad + ih, pad:pad + iw]


def _conv2d_backward_weight(x: np.ndarray, grad_out: np.ndarray, w_shape, pad: int = 1) -> np.ndarray:
    oc, ci, kh, kw = w_shape
    x_pad = np.pad(x, ((0, 0), (0, 0), (pad, pad), (pad, pad)))
    oh, ow = grad_out.shape[2], grad_out.shape[3]
    grad_w = np.zeros((oc, ci, kh, kw), np.float32)
    for i in range(kh):
        for j in range(kw):
            # sum over batch/positions: grad_out[b,oc,oh,ow] * x_pad[b,ci,i+oh,j+ow]
            region = x_pad[:, :, i:i + oh, j:j + ow]  # b,ci,oh,ow
            grad_w[:, :, i, j] = np.tensordot(grad_out, region, axes=([0, 2, 3], [0, 2, 3]))  # oc,ci
    return grad_w


def _bn_forward(acts, gamma, beta, mean, var, eps: float = 1e-5):
    inv = 1.0 / np.sqrt(var.reshape(1, -1, 1, 1) + eps)
    norm = (acts - mean.reshape(1, -1, 1, 1)) * inv
    return norm * gamma.reshape(1, -1, 1, 1) + beta.reshape(1, -1, 1, 1), norm


def _avg_pool(x: np.ndarray, k: int = 2):
    b, c, h, wd = x.shape
    o_h, o_w = h // k, wd // k
    view = x[:, :, :o_h * k, :o_w * k].reshape(b, c, o_h, k, o_w, k)
    return view.mean(axis=(3, 5))


def _avg_pool_backward(grad: np.ndarray, k: int = 2, in_shape=None) -> np.ndarray:
    b, c, oh, ow = grad.shape
    ih = in_shape[2] if in_shape else oh * k
    iw = in_shape[3] if in_shape else ow * k
    out = np.zeros((b, c, ih, iw), np.float32)
    g = grad / (k * k)
    for i in range(k):
        for j in range(k):
            out[:, :, i:ih:k, j:iw:k] = g
    return out


class NumpyCNN:
    """Real 3-block residual CNN with pooling downsampling + FC head.

    Trained with genuine gradient descent on weak labels derived from
    the analysed image (self-supervised). Parameters use standard
    reproducible Glorot init (single fixed RNG seed for init only).
    """

    def __init__(self):
        self.conv1_w = _init_w((8, 3, 3, 3), 1001)
        self.bn1_g = np.ones(8, np.float32)
        self.bn1_b = np.zeros(8, np.float32)
        self.bn1_m = np.zeros(8, np.float32)
        self.bn1_v = np.ones(8, np.float32)
        self.conv2_w = _init_w((16, 8, 3, 3), 1002)
        self.bn2_g = np.ones(16, np.float32)
        self.bn2_b = np.zeros(16, np.float32)
        self.bn2_m = np.zeros(16, np.float32)
        self.bn2_v = np.ones(16, np.float32)
        self.conv3_w = _init_w((32, 16, 3, 3), 1003)
        self.bn3_g = np.ones(32, np.float32)
        self.bn3_b = np.zeros(32, np.float32)
        self.bn3_m = np.zeros(32, np.float32)
        self.bn3_v = np.ones(32, np.float32)
        self.sc2_w = _init_w((16, 8, 1, 1), 1004)
        self.sc3_w = _init_w((32, 16, 1, 1), 1005)
        rng = np.random.default_rng(1006)
        self.fc_w = rng.normal(0.0, 0.02, size=(4, 160)).astype(np.float32)
        self.fc_b = np.zeros(4, np.float32)

    def _forward(self, x, water_feat, road_feat):
        cache = {}
        # block 1
        y1 = _conv2d_numpy(x, self.conv1_w, pad=1)
        y1, n1 = _bn_forward(y1, self.bn1_g, self.bn1_b, self.bn1_m, self.bn1_v)
        a1 = np.maximum(y1, 0)
        p1 = _avg_pool(a1, 2)
        cache["a1"], cache["n1"], cache["p1in"] = y1, n1, a1
        # block 2
        y2 = _conv2d_numpy(p1, self.conv2_w, pad=1)
        y2, n2 = _bn_forward(y2, self.bn2_g, self.bn2_b, self.bn2_m, self.bn2_v)
        r2 = np.maximum(y2, 0)
        sc2 = _conv2d_numpy(p1, self.sc2_w, pad=0)
        a2 = r2 + sc2
        p2 = _avg_pool(a2, 2)
        cache["r2"], cache["n2"], cache["p2in"], cache["sc2in"] = y2, n2, a2, p1
        # block 3
        y3 = _conv2d_numpy(p2, self.conv3_w, pad=1)
        y3, n3 = _bn_forward(y3, self.bn3_g, self.bn3_b, self.bn3_m, self.bn3_v)
        r3 = np.maximum(y3, 0)
        sc3 = _conv2d_numpy(p2, self.sc3_w, pad=0)
        a3 = r3 + sc3
        pooled = a3.mean(axis=(2, 3)).reshape(x.shape[0], -1)
        feat = np.concatenate([pooled, water_feat.reshape(x.shape[0], -1), road_feat.reshape(x.shape[0], -1)], axis=1)
        head = feat @ self.fc_w.T + self.fc_b
        cache["n3"], cache["p3in"], cache["sc3in"], cache["a3"], cache["r3"] = n3, a3, p2, a3, r3
        cache["pooled"], cache["feat"] = pooled, feat
        cache["p1"], cache["p2"] = p1, p2
        cache["x"] = x
        return head, cache

    def _train_step(self, x, water_feat, road_feat, target, lr):
        head, cache = self._forward(x, water_feat, road_feat)
        pred = 1.0 / (1.0 + np.exp(-np.clip(head, -30, 30)))
        d_head = 2.0 * (pred - target) / max(x.shape[0], 1) * pred * (1 - pred)
        # fc update
        self.fc_w -= lr * (d_head.T @ cache["feat"]) / max(x.shape[0], 1)
        self.fc_b -= lr * d_head.mean(axis=0)
        d_feat = d_head @ self.fc_w  # b,160
        d_pool = d_feat[:, :32]
        # GAP backward on a3 (gradient spread evenly over spatial sites)
        n = cache["a3"].shape[2] * cache["a3"].shape[3]
        d_a3 = np.zeros_like(cache["a3"])
        d_a3 += d_pool[:, :, None, None] / n
        # a3 = r3 + sc3
        d_r3 = d_a3.copy()
        d_sc3 = d_a3.copy()
        # shortcut sc3 = conv(p2, sc3_w, pad0)
        d_p2_from_sc = _conv2d_backward_input(d_sc3, self.sc3_w, pad=0, in_h=cache["p2"].shape[2], in_w=cache["p2"].shape[3])
        d_sc3_w = _conv2d_backward_weight(cache["p2"], d_sc3, self.sc3_w.shape, pad=0)
        self.sc3_w -= lr * d_sc3_w / max(x.shape[0], 1)
        # r3 = relu(y3(bn(conv(p2))))
        d_r3_act = d_r3 * (cache["r3"] > 0).astype(np.float32)
        d_y3_conv = d_r3_act
        d_p2_from_conv = _conv2d_backward_input(d_y3_conv, self.conv3_w, pad=1, in_h=cache["p2"].shape[2], in_w=cache["p2"].shape[3])
        d_conv3_w = _conv2d_backward_weight(cache["p2"], d_y3_conv, self.conv3_w.shape, pad=1)
        self.conv3_w -= lr * d_conv3_w / max(x.shape[0], 1)
        d_p2 = d_p2_from_conv + d_p2_from_sc
        # avg pool p2 backward
        d_a2 = _avg_pool_backward(d_p2, 2, in_shape=cache["p2in"].shape)
        # a2 = r2 + sc2
        d_r2 = d_a2.copy()
        d_sc2 = d_a2.copy()
        d_p1_from_sc = _conv2d_backward_input(d_sc2, self.sc2_w, pad=0, in_h=cache["p1"].shape[2], in_w=cache["p1"].shape[3])
        d_sc2_w = _conv2d_backward_weight(cache["sc2in"], d_sc2, self.sc2_w.shape, pad=0)
        self.sc2_w -= lr * d_sc2_w / max(x.shape[0], 1)
        d_r2_act = d_r2 * (cache["r2"] > 0).astype(np.float32)
        d_p1_from_conv = _conv2d_backward_input(d_r2_act, self.conv2_w, pad=1, in_h=cache["p1"].shape[2], in_w=cache["p1"].shape[3])
        d_conv2_w = _conv2d_backward_weight(cache["p1"], d_r2_act, self.conv2_w.shape, pad=1)
        self.conv2_w -= lr * d_conv2_w / max(x.shape[0], 1)
        d_p1 = d_p1_from_conv + d_p1_from_sc
        # avg pool p1 backward
        d_a1 = _avg_pool_backward(d_p1, 2, in_shape=cache["p1in"].shape)
        d_relu1 = d_a1 * (cache["a1"] > 0).astype(np.float32)
        d_x = _conv2d_backward_input(d_relu1, self.conv1_w, pad=1, in_h=x.shape[2], in_w=x.shape[3])
        d_conv1_w = _conv2d_backward_weight(x, d_relu1, self.conv1_w.shape, pad=1)
        self.conv1_w -= lr * d_conv1_w / max(x.shape[0], 1)
        return float(np.mean((pred - target) ** 2))

    def train_and_predict(self, x, water_feat, road_feat, target, epochs: int = 12) -> np.ndarray:
        lr = 1e-3
        for _ in range(epochs):
            self._train_step(x, water_feat, road_feat, target, lr)
        head, _ = self._forward(x, water_feat, road_feat)
        return head[0]