ARG COMPUTE_TARGET=cpu

FROM python:3.11-slim AS base-cpu

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libchromaprint-dev \
    libchromaprint-tools \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-common.txt requirements-cpu.txt ./
RUN pip install --no-cache-dir -r requirements-common.txt && \
    pip install --no-cache-dir -r requirements-cpu.txt

FROM nvidia/cuda:12.6.0-devel-ubuntu22.04 AS ffmpeg-builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    nasm \
    yasm \
    git \
    wget \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch n12.2.72.0 https://git.videolan.org/git/ffmpeg/nv-codec-headers.git && \
    cd nv-codec-headers && \
    make install && \
    cd .. && \
    rm -rf nv-codec-headers

RUN wget -q https://ffmpeg.org/releases/ffmpeg-7.1.tar.xz && \
    tar -xf ffmpeg-7.1.tar.xz && \
    cd ffmpeg-7.1 && \
    ./configure \
        --prefix=/usr/local \
        --enable-nonfree \
        --enable-cuda-nvcc \
        --enable-libnpp \
        --enable-cuvid \
        --enable-nvdec \
        --enable-nvenc \
        --enable-gpl \
        --enable-shared \
        --disable-static \
        --disable-doc \
        --disable-htmlpages \
        --disable-podpages \
        --disable-txtpages \
        --extra-cflags=-I/usr/local/cuda/include \
        --extra-ldflags=-L/usr/local/cuda/lib64 && \
    make -j$(nproc) && \
    make install

FROM nvidia/cuda:12.6.0-runtime-ubuntu22.04 AS base-gpu

WORKDIR /app

COPY --from=ffmpeg-builder /usr/local/bin/ffmpeg /usr/local/bin/
COPY --from=ffmpeg-builder /usr/local/bin/ffprobe /usr/local/bin/
COPY --from=ffmpeg-builder /usr/local/lib/lib*.so* /usr/local/lib/
COPY --from=ffmpeg-builder /usr/local/include/ /usr/local/include/

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-venv \
    python3.11-dev \
    python3-pip \
    ca-certificates \
    libchromaprint-dev \
    libchromaprint-tools \
    libpq-dev \
    gcc \
    pkg-config \
    && rm -rf /var/lib/apt/lists/* \
    && ldconfig

RUN ln -sf /usr/bin/python3.11 /usr/bin/python && \
    python3.11 -m pip install --upgrade pip

COPY requirements-common.txt requirements-gpu.txt ./
RUN python3.11 -m pip install --no-cache-dir -r requirements-gpu.txt && \
    python3.11 -m pip install --no-cache-dir -r requirements-common.txt

FROM base-${COMPUTE_TARGET} AS final

WORKDIR /app

COPY start-worker.sh .
RUN chmod +x start-worker.sh

COPY . .

CMD ["./start-worker.sh"]
