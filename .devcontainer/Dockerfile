FROM node:20
RUN apt update && apt install sudo --yes
RUN usermod -g users -aG sudo,node node \
    && echo node ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/node \
    && chmod 0440 /etc/sudoers.d/node
USER node
